import { sleep, swapToken2Token, swapETH2Token } from './utils'
import { arbitrumSwapList, odesseySwapList } from './swapList'

async function main(privateKey: string) {
  for (let i = 0; i < arbitrumSwapList.length; i++) {
    await swapETH2Token(
      privateKey,
      odesseySwapList[i].tokenName,
      odesseySwapList[i].tokenAddr,
      odesseySwapList[i].tokenDecimal,
    )
    // await swapToken2Token(
    //   privateKey,
    //   arbitrumSwapList[i].tokenName,
    //   arbitrumSwapList[i].tokenAddr,
    //   arbitrumSwapList[i].tokenDecimal,
    //   arbitrumSwapList[i].tokenSlippage,
    //   arbitrumSwapList[i].tokenValue,
    //   arbitrumSwapList[i + 1].tokenName,
    //   arbitrumSwapList[i + 1].tokenAddr,
    //   arbitrumSwapList[i + 1].tokenDecimal,
    // )
    if (i + 1 === odesseySwapList.length - 1) break
    // await sleep(10 * 1000)
  }
}

main(process.argv[2])
