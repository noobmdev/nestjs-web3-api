import { JsonFragment } from '@ethersproject/abi';
import { recoverPersonalSignature } from '@metamask/eth-sig-util';
import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ethers, TypedDataDomain, TypedDataField, Wallet } from 'ethers';

@Injectable()
export class Web3Service {
  async sendTransaction(
    rpc: string,
    fromPrivateKey: string,
    to: string,
    data: string,
    value: string,
  ): Promise<ethers.providers.TransactionReceipt> {
    // init provider and signer
    const wallet = this.getSigner(fromPrivateKey, rpc);

    // tx data
    const txData = {
      to,
      data,
      value,
    };

    // get nonce
    const [nonce, gasLimit] = await Promise.all([
      wallet.provider.getTransactionCount(wallet.address),
      wallet.estimateGas(txData),
    ]);

    // sign and send tx - wait for receipt
    const tx = await wallet.sendTransaction({
      ...txData,
      nonce,
      gasLimit,
    });
    return tx.wait();
  }

  validateSignature(account: string, signature: string, msg: string): boolean {
    let recoveredAddr: string;

    try {
      recoveredAddr = recoverPersonalSignature({
        data: msg,
        signature: signature,
      });
    } catch (err) {
      throw new UnauthorizedException('Problem with signature verification.');
    }

    if (recoveredAddr.toLowerCase() !== account.toLowerCase()) {
      throw new BadRequestException('Signature is not correct.');
    }

    return true;
  }

  getProvider(rpc: string) {
    return new ethers.providers.StaticJsonRpcProvider(rpc);
  }

  getSigner(fromPrivateKey: string, rpc: string): Wallet {
    const provider = new ethers.providers.StaticJsonRpcProvider(rpc);
    return new Wallet(fromPrivateKey, provider);
  }

  getContract(
    addressOrName: string,
    contractInterface: ethers.ContractInterface,
    signerOrProvider: ethers.providers.Provider | ethers.Signer,
  ): ethers.Contract {
    return new ethers.Contract(
      addressOrName,
      contractInterface,
      signerOrProvider,
    );
  }

  async callContract(
    contract: ethers.Contract,
    method: string,
    args: any[],
    overrides: { [key: string]: any } = {},
  ): Promise<ethers.utils.Result | ethers.providers.TransactionResponse> {
    try {
      const tx: ethers.utils.Result | ethers.providers.TransactionResponse =
        await contract[method](...args, {
          ...overrides,
        });
      if (typeof tx.wait !== 'function') return tx;
      const res = await tx.wait();
      return res;
    } catch (error) {
      throw error?.reason?.reason ?? error?.error?.message ?? error;
    }
  }

  getContractInterface(
    fragments:
      | string
      | readonly (string | ethers.utils.Fragment | JsonFragment)[],
  ): ethers.utils.Interface {
    return new ethers.utils.Interface(fragments);
  }

  domainEIP712(
    name: string,
    version: string,
    verifyingContract: string,
    chainId: number,
  ): TypedDataDomain {
    return {
      name,
      version,
      verifyingContract,
      chainId,
    };
  }

  _signTypedDataV4(
    wallet: Wallet,
    domain: TypedDataDomain,
    types: Record<string, TypedDataField[]>,
    value: Record<string, any>,
  ): Promise<string> {
    return wallet._signTypedData(domain, types, value);
  }

  getTransaction(provider: ethers.providers.Provider, txHash: string) {
    return provider.getTransactionReceipt(txHash);
  }

  decodeTransactionLogs(
    abi: string | readonly (string | ethers.utils.Fragment | JsonFragment)[],
    transactionLogs: any[],
  ): ethers.utils.LogDescription[] {
    const iface = this.getContractInterface(abi);
    return transactionLogs.map((log) => {
      try {
        return iface.parseLog(log);
      } catch {
        return null;
      }
    });
  }
}
