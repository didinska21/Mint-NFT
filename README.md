# NFT FCFS Minting Bot

Universal NFT minting bot yang mendukung **Ethereum Mainnet**, **BSC**, dan **Base Network**.

## 🚀 Features

- ✅ Auto-detect contract address & ABI
- ✅ Direct contract interaction (super fast!)
- ✅ Multi-network support (ETH, BSC, Base)
- ✅ Auto-retry sampai supply penuh
- ✅ Live monitoring (supply, gas, tx status)
- ✅ Configurable gas settings

---

## 📦 Installation

### 1. Install Node.js
```bash
apt install nodejs
```
```bash
apt install git
```
### 2. Clone/Download bot in
```bash
git clone https://github.com/didinska21/Mint-NFT
```
### 3. Install dependencies
```bash
npm install
```

### 4. Setup `.env` file
Edit `.env` dengan cara 
```bash
nano .env
```
dan isi:
```.env
PRIVATE_KEY=your_private_key_here
ETHERSCAN_API_KEY=your_api_key (optional)
```

**⚠️ PENTING:** 
- Jangan share private key ke siapapun!
- Untuk VPS, gunakan wallet khusus dengan dana terbatas
- Backup private key di tempat aman

---

## 🎯 Usage

### Start bot:
```bash
node main.js
```

### Menu Options:

#### **1. Detect Contract - Manual Trigger Mode**
- Buka website mint di headless browser
- Script intercept transaction saat Anda klik mint
- Extract contract address & ABI
- Save ke `mint_config.json`

**Cara pakai:**
1. Pilih menu 1
2. Input URL website mint (contoh: https://coolnft.com/mint)
3. Pilih network (eth/bsc/base)
4. Bot akan tunggu Anda manually trigger mint
5. Press Enter setelah mint transaction muncul
6. Config otomatis tersimpan

#### **2. Detect Contract - Code Analysis Mode**
- Analisis source code website
- Cari contract address dari JavaScript
- Verify contract di blockchain
- Fetch ABI dari explorer

**Cara pakai:**
1. Pilih menu 2
2. Input URL website mint
3. Pilih network
4. Bot cari contract address di source code
5. Pilih contract yang benar
6. Config otomatis tersimpan

#### **3. Run FCFS Mint Bot**
- Load config dari menu 1 atau 2
- Connect wallet dengan private key
- Loop mint sampai supply penuh
- Auto-retry jika gagal

**Cara pakai:**
1. Pastikan sudah detect contract (menu 1 atau 2)
2. Pilih menu 3
3. Input jumlah NFT per transaksi
4. Set max gas price (atau Enter untuk auto)
5. Bot mulai minting!

**Bot akan:**
- ✅ Cek apakah mint sudah aktif
- ✅ Monitor supply real-time
- ✅ Retry otomatis sampai supply habis
- ✅ Show TX hash & explorer link
- ✅ Count success/failed transactions

#### **4. Test Contract Status**
- Cek apakah contract aktif
- Check current supply
- Check mint price
- Estimate gas

---

## ⚙️ Configuration

### Gas Settings (optional)
Di file `.env`:
```env
MAX_GAS_PRICE=50        # Max gas dalam Gwei
GAS_LIMIT=300000        # Manual gas limit
```

Atau kosongkan untuk auto gas calculation.

### Custom RPC (optional)
Ganti RPC endpoint di `.env` untuk speed lebih cepat:
```env
ETH_RPC_URL=https://your-custom-rpc.com
```

---

## 🔧 Troubleshooting

### Bot tidak detect contract?
- **Manual Mode:** Pastikan Anda trigger mint transaction
- **Code Mode:** Website mungkin load contract dynamic via API
- **Solusi:** Coba mode yang lain, atau manual input contract address

### Transaction gagal terus?
- Cek balance wallet cukup untuk gas + mint price
- Coba naikkan gas price
- Cek apakah mint sudah aktif (pakai menu 4)
- Cek max mint per wallet

### "Insufficient funds"
- Top up wallet Anda
- Kurangi jumlah mint per transaction

### ABI tidak ketemu?
- Contract mungkin belum verified
- Bot akan pakai minimal ABI (mint function umum)
- Bisa manual add ABI di `mint_config.json`

---

## 📝 Example Config File

File `mint_config.json` yang auto-generate:

```json
{
  "projectName": "https://coolnft.com/mint",
  "network": "eth",
  "contractAddress": "0x1234567890abcdef...",
  "abi": [...],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

Anda bisa edit manual jika perlu.

---

## ⚠️ Disclaimer

- Bot ini untuk **educational purposes**
- Gunakan dengan **risiko sendiri**
- Pastikan Anda paham cara kerja smart contract
- Jangan gunakan wallet utama untuk testing
- Author tidak bertanggung jawab atas kerugian

---

## 🤝 Tips

### Untuk VPS Setup:
```bash
# Install Node.js di Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Chrome dependencies untuk Puppeteer
sudo apt-get install -y chromium-browser

# Clone & run bot
git clone <your-repo>
cd nft-minting-bot
npm install
npm start
```

### Untuk Speed Maksimal:
1. Gunakan VPS dekat dengan RPC node
2. Pakai private RPC endpoint (Alchemy, Infura, QuickNode)
3. Set gas price agresif (10-20% lebih tinggi dari average)
4. Monitor mempool untuk front-run opportunity

---

## 📊 Example Output

```
[12:00:00] === FCFS Mint Bot ===
[12:00:01] Wallet: 0xYourWallet...
[12:00:02] Starting mint bot...
[12:00:03] Supply: 34/1000
[12:00:04] Attempting mint(1)...
[12:00:05] TX sent: 0xabcdef...
[12:00:06] Explorer: https://etherscan.io/tx/0xabcdef...
[12:00:10] ✅ Mint successful! (1 success, 0 failed)
[12:00:11] Supply: 35/1000
...
```

---

## 🔐 Security Notes

1. **Never** commit `.env` file
2. Use `.gitignore` untuk exclude sensitive files
3. Rotate private keys regularly
4. Use hardware wallet untuk fund besar
5. Test di testnet dulu sebelum mainnet

---

## 📞 Support

Jika ada bug atau pertanyaan, silakan buat issue di repository ini.

**Happy Minting! 🚀**
