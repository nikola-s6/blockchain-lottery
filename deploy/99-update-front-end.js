const { ethers } = require("hardhat")
const fs = require("fs")

const FRONT_END_ADDRESSES_FILE = "../new-nextjs-raffle/constants/contractAddresses.json"
const FRONT_ABI_FILE = "../new-nextjs-raffle/constants/abi.json"

module.exports = async function () {
  if (process.env.UPDATE_FRONT_END) {
    console.log("updating front end...")
    updateContractAddresses()
    updateAbi()
    console.log("fron end updated!")
  }
}

async function updateContractAddresses() {
  const raffle = await ethers.getContract("Raffle")
  const chainId = network.config.chainId.toString()
  const currentAddresses = JSON.parse(fs.readFileSync(FRONT_END_ADDRESSES_FILE, "utf8"))
  if (chainId in currentAddresses) {
    if (!currentAddresses[chainId].includes(raffle.address)) {
      currentAddresses[chainId].push(raffle.address)
    }
  } else {
    currentAddresses[chainId] = [raffle.address]
  }
  fs.writeFileSync(FRONT_END_ADDRESSES_FILE, JSON.stringify(currentAddresses))
}

async function updateAbi() {
  const raffle = await ethers.getContract("Raffle")
  fs.writeFileSync(FRONT_ABI_FILE, raffle.interface.format(ethers.utils.FormatTypes.json))
}

module.exports.tags = ["all", "frontend"]
