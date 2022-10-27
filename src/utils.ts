import axios from 'axios'
import odosABI from './config/ODOS_ABI.json'
import { BigNumber, Contract, ethers, Wallet } from 'ethers'
import { ISwapArgus } from './types'
import { parseEther, parseUnits } from 'ethers/lib/utils'
import Request from './utils/request'

const ERC20ABI = [
  'function balanceOf(address) public view returns (uint)',
  'function transfer(address, uint) public returns (bool)',
  'function approve(address, uint) public returns (bool)',
  'function allowance(address, address) public view returns (uint)',
]

let chainID = 'arbitrum'

const ALCHEYMY_KEY =
  chainID === 'arbitrum' ? 'Your Alchemy RPC' : 'Your Polygon RPC'

const odosAddr =
  chainID === 'arbitrum'
    ? '0xdd94018F54e565dbfc939F7C44a16e163FaAb331'
    : '0xa32ee1c40594249eb3183c10792bcf573d4da47c'

const provider = new ethers.providers.JsonRpcProvider(ALCHEYMY_KEY)

const request = new Request('https://app.odos.xyz/', 5000)

function sleep(ms: number) {
  console.log('Slepping.................................')
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function getNeedContract(
  privateKey: string,
  fromTokenAddr: string,
  toTokenAddr: string,
) {
  const wallet = new ethers.Wallet(privateKey, provider)
  const odos = new ethers.Contract(odosAddr, odosABI, wallet)
  const fromTokenContract = new ethers.Contract(fromTokenAddr, ERC20ABI, wallet)
  const toTokenContract = new ethers.Contract(toTokenAddr, ERC20ABI, wallet)

  return { wallet, odos, fromTokenContract, toTokenContract }
}

async function getGasPrice(): Promise<number | null> {
  let times = 5
  let gasPrice = null

  const polygonGetGasPrice = async () => {
    return await request.get('gas-prices/0x89')
  }

  const arbitrumGetGasPrice = async () => {
    return await axios.post(
      'https://arb1.arbitrum.io/rpc',
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_gasPrice',
        params: [],
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  }

  while (times > 0) {
    try {
      console.log('Get Gas Price')
      if (chainID === 'polygon') {
        const result = await polygonGetGasPrice()
        gasPrice = parseFloat(result.data.fast)
      } else if (chainID === 'arbitrum') {
        const result = await arbitrumGetGasPrice()
        gasPrice = parseFloat('' + result.data.result / 10 ** 9)
      }
      times = 0
      console.log('Get Gas Price Done')
    } catch (error) {
      console.log('Get Gas Price Failed. Retrying...')
      times--
    }
  }
  return gasPrice
}

async function getSwapArguments(
  fromValues: (number | BigNumber)[],
  fromTokens: string[],
  toTokens: string[],
  userAddress: string,
  chain: string = 'arbitrum',
  slippageAmount: number = 1,
): Promise<ISwapArgus | null> {
  console.log('Get Swap Arguments')
  // const gasPrice = await getGasPrice()

  const URL = 'request-path'
  const data = {
    fromValues,
    fromTokens,
    toTokens,
    chain,
    slippageAmount,
    walletAddress: userAddress,
    gasPrice: 0.1,
  }

  const resp = await request.post(URL, data)

  if (resp.status !== 200) return null

  const inputs = {
    tokenAddress: resp.data.inTokens[0],
    amountIn: resp.data.inAmounts[0],
    receiver: resp.data.inputDests[0],
    permit: '0x',
  }
  const outputs = {
    tokenAddress: resp.data.outTokens[0],
    relativeValue: 1,
    receiver: userAddress,
  }
  const valueOutQuote = resp.data.outAmounts[0]
  const valueOutMin = ((valueOutQuote as number) * (100 - slippageAmount)) / 100
  // const executor = resp.data.inputDests[0]
  const executor = '0x3373605b97d079593216a99ceF357C57D1D9648e'
  const pathDefinition = '0x' + resp.data.pathDefBytes

  const gasLimit = resp.data.gasEstimate * 2
  const override = {
    gasLimit,
    maxFeePerGas: ethers.utils.parseUnits('1', 8),
    maxPriorityFeePerGas: ethers.utils.parseUnits('1', 8),
  }

  console.log('Get Swap Arguments Done')
  return {
    inputs: [inputs],
    outputs: [outputs],
    valueOutQuote,
    valueOutMin,
    executor,
    pathDefinition,
    override,
  }
}

async function approve(token: Contract, owner: string, spender: string) {
  // Don't need approve
  if (token.address === '0x0000000000000000000000000000000000000000') return

  console.log(`get allowance...`)
  const allowance: BigNumber = await token.allowance(owner, spender)

  console.log(`allowance: ${allowance}`)
  // Insufficient Allowance
  if (allowance.toBigInt() < BigInt(200000000 * 10 ** 18)) {
    console.log(`approve allowance due to insufficient allowance`)
    const approveAllowance = BigNumber.from(
      '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    )

    const approveTx = await token.approve(odosAddr, approveAllowance, {
      gasLimit: 500000,
      maxFeePerGas: ethers.utils.parseUnits('2', 8),
      maxPriorityFeePerGas: ethers.utils.parseUnits('1', 8),
    })
    await approveTx.wait()

    console.log(`approve done`)
    return
  }
  console.log(`don't approve again`)
}

async function swapToken2Token(
  privateKey: string,
  fromTokenName: string,
  fromTokenAddr: string,
  fromTokenDecimal: number,
  fromTokenSlippage: number,
  fromTokenValue: number,
  toTokenName: string,
  toTokenAddr: string,
  toTokenDecimal: number,
) {
  let balance
  let passedTokenValue = fromTokenValue !== 0

  const { wallet, odos, fromTokenContract } = await getNeedContract(
    privateKey,
    fromTokenAddr,
    toTokenAddr,
  )

  const userAddress = await wallet.getAddress()

  await approve(fromTokenContract, userAddress, odosAddr)

  if (fromTokenValue === 0) {
    balance = await fromTokenContract.balanceOf(userAddress)
    fromTokenValue = parseFloat(
      ethers.utils.formatUnits(balance, fromTokenDecimal),
    )
  }

  console.log('Contract Value: ', fromTokenValue)

  const swapArguments = await getSwapArguments(
    [fromTokenValue],
    [fromTokenAddr],
    [toTokenAddr],
    userAddress,
    chainID,
    fromTokenSlippage,
  )

  if (swapArguments) {
    if (passedTokenValue) {
      swapArguments.inputs[0].amountIn = parseEther(
        swapArguments.inputs[0].amountIn.toString(),
      )
    } else {
      // Use Contract Balance
      swapArguments.inputs[0].amountIn = balance as BigNumber
    }

    const float = swapArguments.valueOutQuote.toString().split('.')[1]

    if (float && float.length > toTokenDecimal) {
      const index =
        swapArguments.valueOutQuote.toString().indexOf('.') + 1 + toTokenDecimal
      swapArguments.valueOutQuote = parseUnits(
        swapArguments.valueOutQuote.toString().slice(0, index),
        toTokenDecimal,
      )
      swapArguments.valueOutMin = parseUnits(
        swapArguments.valueOutMin.toString().slice(0, index),
        toTokenDecimal,
      )
    } else {
      swapArguments.valueOutQuote = parseUnits(
        swapArguments.valueOutQuote.toString(),
        toTokenDecimal,
      )
      swapArguments.valueOutMin = parseUnits(
        swapArguments.valueOutMin.toString(),
        toTokenDecimal,
      )
    }

    console.log(
      `swaping ${swapArguments.inputs[0].amountIn.toString()} ${fromTokenName} for ${
        swapArguments.valueOutQuote
      } ${toTokenName}`,
    )

    if (fromTokenAddr === '0x0000000000000000000000000000000000000000')
      swapArguments.override.value = swapArguments.inputs[0].amountIn

    try {
      const swapToken2TokenTx = await odos.swap(
        swapArguments.inputs,
        swapArguments.outputs,
        swapArguments.valueOutQuote,
        swapArguments.valueOutMin,
        swapArguments.executor,
        swapArguments.pathDefinition,
        swapArguments.override,
      )

      await swapToken2TokenTx.wait()

      const hash = `Tx Hash: ${
        chainID === 'arbitrum'
          ? 'https://arbiscan.io/tx/'
          : 'https://polygonscan.com/tx/'
      }${swapToken2TokenTx.hash}`

      console.log(`[${userAddress}]: ${hash}`)
    } catch (error) {
      console.error('Error: ', error)
    }
  }
}

async function getETHAmount(
  fromTokens: string,
  fromValues: number,
  walletAddress: string,
) {
  console.log('Get ETH Amount')
  const URL = 'request-path'

  const data = {
    chain: 'arbitrum',
    fromTokens: [fromTokens],
    fromValues: [fromValues],
    gasPrice: 0.1,
    lpBlacklist: [],
    slippageAmount: 1,
    toTokens: ['0x0000000000000000000000000000000000000000'],
    walletAddress,
  }

  const resp = await request.post(URL, data)

  if (resp.status !== 200) return null

  const value = resp.data.outValues[0]

  console.log('Get ETH Done')
  return value
}

async function swapETH2Token(
  privateKey: string,
  toTokenName: string,
  toTokenAddr: string,
  toTokenDecimal: number,
) {
  // 0. 获取钱包地址 & Odos
  const wallet = new ethers.Wallet(privateKey, provider)
  const userAddress = await wallet.getAddress()
  const odos = new ethers.Contract(odosAddr, odosABI, wallet)

  // 1. 获取 ETH 数量
  const ethAmount = await getETHAmount(toTokenAddr, 0.012, userAddress)

  // 2. 获取 Swap 数据，交易额较小，滑点为 5
  const swapArguments = await getSwapArguments(
    [ethAmount],
    ['0x0000000000000000000000000000000000000000'],
    [toTokenAddr],
    userAddress,
    chainID,
    5,
  )

  // console.log(swapArguments)

  // 3. Swap ETH to Token
  if (swapArguments) {
    swapArguments.override.value = parseEther(ethAmount.toString())

    swapArguments.inputs[0].amountIn = parseEther(
      swapArguments.inputs[0].amountIn.toString(),
    )

    swapArguments.valueOutQuote = parseUnits(
      swapArguments.valueOutQuote.toString(),
      toTokenDecimal,
    )
    swapArguments.valueOutMin = parseUnits(
      swapArguments.valueOutMin.toString(),
      toTokenDecimal,
    )

    console.log(swapArguments)

    try {
      const swapTx = await odos.callStatic.swap(
        swapArguments.inputs,
        swapArguments.outputs,
        swapArguments.valueOutQuote,
        swapArguments.valueOutMin,
        swapArguments.executor,
        swapArguments.pathDefinition,
        swapArguments.override,
      )

      console.log(swapTx)

      // await swapTx.wait()

      // const hash = `Tx Hash: https://arbiscan.io/tx/${swapTx.hash}`

      // console.log(`[${userAddress}]: ${hash}`)
    } catch (error) {
      console.error('Error: ', error)
    }
  }
}

export { getSwapArguments, swapToken2Token, swapETH2Token, getGasPrice, sleep }
