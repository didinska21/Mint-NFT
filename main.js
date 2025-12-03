// NFT FCFS Minting Bot
// Supports: Ethereum Mainnet, BSC, Base

const ethers = require('ethers');
const puppeteer = require('puppeteer');
const axios = require('axios');
const fs = require('fs');
const readline = require('readline');
require('dotenv').config();

// ==================== CONFIG ====================
const NETWORKS = {
  eth: {
    name: 'Ethereum Mainnet',
    rpcUrl: process.env.ETH_RPC_URL || 'https://eth.llamarpc.com',
    chainId: 1,
    explorer: 'https://etherscan.io',
    explorerApi: 'https://api.etherscan.io/api',
    apiKey: process.env.ETHERSCAN_API_KEY || ''
  },
  bsc: {
    name: 'BSC',
    rpcUrl: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org',
    chainId: 56,
    explorer: 'https://bscscan.com',
    explorerApi: 'https://api.bscscan.com/api',
    apiKey: process.env.BSCSCAN_API_KEY || ''
  },
  base: {
    name: 'Base',
    rpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
    chainId: 8453,
    explorer: 'https://basescan.org',
    explorerApi: 'https://api.basescan.org/api',
    apiKey: process.env.BASESCAN_API_KEY || ''
  }
};

const CONFIG_FILE = 'mint_config.json';

// ==================== UTILITIES ====================
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function log(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    error: '\x1b[31m',
    warning: '\x1b[33m'
  };
  console.log(`${colors[type]}[${timestamp}] ${message}\x1b[0m`);
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  log('Config saved to ' + CONFIG_FILE, 'success');
}

function loadConfig() {
  if (fs.existsSync(CONFIG_FILE)) {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  }
  return null;
}

// ==================== MENU 1A: MANUAL TRIGGER MODE ====================
async function detectContractManual() {
  log('=== Manual Trigger Mode ===', 'info');
  
  const url = await question('Enter mint website URL: ');
  const network = await question('Select network (eth/bsc/base): ');
  
  if (!NETWORKS[network]) {
    log('Invalid network!', 'error');
    return;
  }

  log('Launching headless browser...', 'info');
  const browser = await puppeteer.launch({ 
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  let detectedContract = null;
  let detectedData = null;

  // Intercept network requests
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = request.url();
    const postData = request.postData();
    
    // Detect eth_sendTransaction or contract interaction
    if (postData && (postData.includes('eth_sendTransaction') || postData.includes('eth_sendRawTransaction'))) {
      try {
        const data = JSON.parse(postData);
        if (data.params && data.params[0]) {
          const tx = data.params[0];
          if (tx.to) {
            detectedContract = tx.to;
            detectedData = tx.data;
            log(`Contract detected: ${detectedContract}`, 'success');
          }
        }
      } catch (e) {}
    }
    
    request.continue();
  });

  await page.goto(url, { waitUntil: 'networkidle2' });
  
  log('Page loaded. Trying to find mint button...', 'info');
  
  // Try to find and click mint button (common selectors)
  const selectors = [
    'button:has-text("Mint")',
    'button:has-text("mint")',
    '[class*="mint"]',
    '[id*="mint"]',
    'button[type="submit"]'
  ];

  log('Please manually trigger mint on the website or press Enter when done...', 'warning');
  await question('Press Enter after triggering mint transaction...');

  await browser.close();

  if (!detectedContract) {
    log('No contract detected. Try again or use Code Analysis Mode.', 'error');
    return;
  }

  // Fetch ABI from explorer
  log('Fetching ABI from blockchain explorer...', 'info');
  const abi = await fetchABI(detectedContract, NETWORKS[network]);

  const config = {
    projectName: url,
    network: network,
    contractAddress: detectedContract,
    abi: abi,
    detectedData: detectedData,
    timestamp: new Date().toISOString()
  };

  saveConfig(config);
  log('Detection complete!', 'success');
}

// ==================== MENU 1B: CODE ANALYSIS MODE ====================
async function detectContractCode() {
  log('=== Code Analysis Mode ===', 'info');
  
  const url = await question('Enter mint website URL: ');
  const network = await question('Select network (eth/bsc/base): ');
  
  if (!NETWORKS[network]) {
    log('Invalid network!', 'error');
    return;
  }

  log('Fetching website source code...', 'info');
  
  try {
    const response = await axios.get(url);
    const html = response.data;

    // Regex patterns for contract addresses
    const patterns = [
      /0x[a-fA-F0-9]{40}/g,
      /contractAddress["\s:=]+["']?(0x[a-fA-F0-9]{40})["']?/gi,
      /MINT_CONTRACT["\s:=]+["']?(0x[a-fA-F0-9]{40})["']?/gi,
      /CONTRACT["\s:=]+["']?(0x[a-fA-F0-9]{40})["']?/gi
    ];

    const foundAddresses = new Set();
    
    patterns.forEach(pattern => {
      const matches = html.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const addr = match.match(/0x[a-fA-F0-9]{40}/);
          if (addr) foundAddresses.add(addr[0]);
        });
      }
    });

    if (foundAddresses.size === 0) {
      log('No contract addresses found in source code.', 'error');
      return;
    }

    log(`Found ${foundAddresses.size} potential contract address(es):`, 'success');
    const addresses = Array.from(foundAddresses);
    addresses.forEach((addr, i) => console.log(`${i + 1}. ${addr}`));

    const choice = await question('Select contract number (or 0 to cancel): ');
    const index = parseInt(choice) - 1;

    if (index < 0 || index >= addresses.length) {
      log('Cancelled.', 'warning');
      return;
    }

    const selectedContract = addresses[index];
    log(`Selected: ${selectedContract}`, 'info');

    // Verify contract on blockchain
    log('Verifying contract on blockchain...', 'info');
    const provider = new ethers.JsonRpcProvider(NETWORKS[network].rpcUrl);
    const code = await provider.getCode(selectedContract);

    if (code === '0x') {
      log('Warning: This address has no contract code!', 'error');
      const proceed = await question('Continue anyway? (y/n): ');
      if (proceed.toLowerCase() !== 'y') return;
    }

    // Fetch ABI
    log('Fetching ABI...', 'info');
    const abi = await fetchABI(selectedContract, NETWORKS[network]);

    const config = {
      projectName: url,
      network: network,
      contractAddress: selectedContract,
      abi: abi,
      timestamp: new Date().toISOString()
    };

    saveConfig(config);
    log('Detection complete!', 'success');

  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

// ==================== FETCH ABI FROM EXPLORER ====================
async function fetchABI(contractAddress, network) {
  try {
    const url = `${network.explorerApi}?module=contract&action=getabi&address=${contractAddress}&apikey=${network.apiKey}`;
    const response = await axios.get(url);
    
    if (response.data.status === '1') {
      log('ABI fetched successfully!', 'success');
      return JSON.parse(response.data.result);
    } else {
      log('Contract not verified. Using minimal ABI.', 'warning');
      return getMinimalMintABI();
    }
  } catch (error) {
    log('Failed to fetch ABI. Using minimal ABI.', 'warning');
    return getMinimalMintABI();
  }
}

function getMinimalMintABI() {
  return [
    "function mint(uint256 amount) payable",
    "function publicMint(uint256 amount) payable",
    "function mintPublic(uint256 amount) payable",
    "function totalSupply() view returns (uint256)",
    "function maxSupply() view returns (uint256)",
    "function mintPrice() view returns (uint256)",
    "function paused() view returns (bool)",
    "function mintActive() view returns (bool)"
  ];
}

// ==================== MENU 2: RUN FCFS MINT BOT ====================
async function runMintBot() {
  log('=== FCFS Mint Bot ===', 'info');

  const config = loadConfig();
  if (!config) {
    log('No config found! Please run detection first (Menu 1).', 'error');
    return;
  }

  log(`Project: ${config.projectName}`, 'info');
  log(`Network: ${NETWORKS[config.network].name}`, 'info');
  log(`Contract: ${config.contractAddress}`, 'info');

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    log('PRIVATE_KEY not found in .env file!', 'error');
    return;
  }

  const network = NETWORKS[config.network];
  const provider = new ethers.JsonRpcProvider(network.rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const contract = new ethers.Contract(config.contractAddress, config.abi, wallet);

  log(`Wallet: ${wallet.address}`, 'info');

  const mintAmount = parseInt(await question('How many NFTs to mint per transaction? '));
  const maxGasPrice = await question('Max gas price in Gwei (or press Enter for auto): ');
  const gasLimit = await question('Gas limit (or press Enter for auto): ');

  log('Starting mint bot...', 'success');
  log('Bot will retry until supply is full. Press Ctrl+C to stop.', 'warning');

  let successCount = 0;
  let failCount = 0;

  while (true) {
    try {
      // Check if mint is active
      let mintActive = true;
      try {
        if (contract.mintActive) {
          mintActive = await contract.mintActive();
        } else if (contract.paused) {
          mintActive = !(await contract.paused());
        }
      } catch (e) {
        // If function doesn't exist, assume mint is active
      }

      if (!mintActive) {
        log('Mint not active yet. Waiting...', 'warning');
        await sleep(2000);
        continue;
      }

      // Check supply
      try {
        const totalSupply = await contract.totalSupply();
        const maxSupply = await contract.maxSupply();
        log(`Supply: ${totalSupply}/${maxSupply}`, 'info');

        if (totalSupply >= maxSupply) {
          log('Supply full! Stopping bot.', 'success');
          break;
        }
      } catch (e) {
        // Continue if supply check fails
      }

      // Get mint price
      let mintPrice = ethers.parseEther('0');
      try {
        if (contract.mintPrice) {
          mintPrice = await contract.mintPrice();
        }
      } catch (e) {}

      const totalValue = mintPrice * BigInt(mintAmount);

      // Prepare transaction options
      const txOptions = {
        value: totalValue
      };

      if (gasLimit) {
        txOptions.gasLimit = parseInt(gasLimit);
      }

      if (maxGasPrice) {
        txOptions.maxFeePerGas = ethers.parseUnits(maxGasPrice, 'gwei');
        txOptions.maxPriorityFeePerGas = ethers.parseUnits('2', 'gwei');
      }

      // Try different mint functions
      const mintFunctions = ['mint', 'publicMint', 'mintPublic'];
      let txSent = false;

      for (const funcName of mintFunctions) {
        try {
          if (contract[funcName]) {
            log(`Attempting ${funcName}(${mintAmount})...`, 'info');
            const tx = await contract[funcName](mintAmount, txOptions);
            log(`TX sent: ${tx.hash}`, 'success');
            log(`Explorer: ${network.explorer}/tx/${tx.hash}`, 'info');
            
            log('Waiting for confirmation...', 'info');
            const receipt = await tx.wait();
            
            if (receipt.status === 1) {
              successCount++;
              log(`✅ Mint successful! (${successCount} success, ${failCount} failed)`, 'success');
            } else {
              failCount++;
              log(`❌ Transaction failed! (${successCount} success, ${failCount} failed)`, 'error');
            }
            
            txSent = true;
            break;
          }
        } catch (e) {
          if (e.message.includes('supply')) {
            log('Supply exhausted!', 'warning');
            return;
          }
          continue;
        }
      }

      if (!txSent) {
        failCount++;
        log(`Failed to send transaction. (${successCount} success, ${failCount} failed)`, 'error');
      }

      // Small delay before next attempt
      await sleep(1000);

    } catch (error) {
      failCount++;
      log(`Error: ${error.message}`, 'error');
      
      if (error.message.includes('insufficient funds')) {
        log('Insufficient funds! Stopping bot.', 'error');
        break;
      }
      
      await sleep(2000);
    }
  }

  log(`Bot stopped. Final: ${successCount} success, ${failCount} failed`, 'info');
}

// ==================== MENU 3: TEST CONTRACT STATUS ====================
async function testContractStatus() {
  log('=== Test Contract Status ===', 'info');

  const config = loadConfig();
  if (!config) {
    log('No config found! Please run detection first (Menu 1).', 'error');
    return;
  }

  const network = NETWORKS[config.network];
  const provider = new ethers.JsonRpcProvider(network.rpcUrl);
  const contract = new ethers.Contract(config.contractAddress, config.abi, provider);

  log(`Testing contract: ${config.contractAddress}`, 'info');
  log(`Network: ${network.name}`, 'info');

  try {
    // Check if contract exists
    const code = await provider.getCode(config.contractAddress);
    if (code === '0x') {
      log('❌ No contract found at this address!', 'error');
      return;
    }
    log('✅ Contract exists', 'success');

    // Check mint status
    try {
      if (contract.mintActive) {
        const isActive = await contract.mintActive();
        log(`Mint Active: ${isActive ? '✅ YES' : '❌ NO'}`, isActive ? 'success' : 'warning');
      } else if (contract.paused) {
        const isPaused = await contract.paused();
        log(`Paused: ${isPaused ? '❌ YES' : '✅ NO'}`, isPaused ? 'error' : 'success');
      }
    } catch (e) {
      log('⚠️  Cannot check mint status', 'warning');
    }

    // Check supply
    try {
      const totalSupply = await contract.totalSupply();
      const maxSupply = await contract.maxSupply();
      log(`Supply: ${totalSupply} / ${maxSupply}`, 'info');
      
      const percentage = (Number(totalSupply) / Number(maxSupply) * 100).toFixed(2);
      log(`Progress: ${percentage}%`, 'info');
    } catch (e) {
      log('⚠️  Cannot check supply', 'warning');
    }

    // Check mint price
    try {
      const mintPrice = await contract.mintPrice();
      log(`Mint Price: ${ethers.formatEther(mintPrice)} ${network.name === 'Ethereum Mainnet' ? 'ETH' : 'BNB'}`, 'info');
    } catch (e) {
      log('⚠️  Cannot check mint price', 'warning');
    }

    // Gas estimate
    try {
      const gasEstimate = await contract.mint.estimateGas(1, { value: ethers.parseEther('0.01') });
      log(`Estimated Gas: ${gasEstimate.toString()}`, 'info');
    } catch (e) {
      log('⚠️  Cannot estimate gas', 'warning');
    }

  } catch (error) {
    log(`Error: ${error.message}`, 'error');
  }
}

// ==================== MAIN MENU ====================
async function mainMenu() {
  console.clear();
  console.log('\x1b[36m');
  console.log('╔════════════════════════════════════════╗');
  console.log('║     NFT FCFS MINTING BOT v1.0         ║');
  console.log('║  Supports: ETH, BSC, Base              ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('\x1b[0m');
  
  console.log('1. Detect Contract - Manual Trigger Mode');
  console.log('2. Detect Contract - Code Analysis Mode');
  console.log('3. Run FCFS Mint Bot');
  console.log('4. Test Contract Status');
  console.log('5. Exit\n');

  const choice = await question('Select option: ');

  switch (choice) {
    case '1':
      await detectContractManual();
      break;
    case '2':
      await detectContractCode();
      break;
    case '3':
      await runMintBot();
      break;
    case '4':
      await testContractStatus();
      break;
    case '5':
      log('Goodbye!', 'success');
      rl.close();
      process.exit(0);
    default:
      log('Invalid option!', 'error');
  }

  await question('\nPress Enter to return to menu...');
  mainMenu();
}

// ==================== START ====================
mainMenu().catch(error => {
  log(`Fatal error: ${error.message}`, 'error');
  process.exit(1);
});
