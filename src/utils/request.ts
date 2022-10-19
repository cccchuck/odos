import axios, { AxiosInstance, AxiosRequestConfig } from 'axios'

class Request {
  private instance: AxiosInstance

  constructor(baseURL: string, timeout: number) {
    this.instance = axios.create({
      baseURL,
      timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }

  get(url: string, config?: AxiosRequestConfig) {
    return this.instance.get(url, config)
  }

  post(url: string, data: any, config?: AxiosRequestConfig) {
    return this.instance.post(url, data, config)
  }
}

export default Request
