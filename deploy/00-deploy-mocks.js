const { network, ethers } = require("hardhat")
const { developmentChains } = require("../helper-hardhat-config")

const BASE_FEE = ethers.utils.parseEther("0.25") //that's how much it costs (0.25 LINK per request), according to the docks
const GAS_PRICE_LINK = 1e9 //calculated value based on price of the chain (basically link per gas)

const args = [BASE_FEE, GAS_PRICE_LINK]

module.exports = async function ({ getNamedAccounts, deployments }) {
  const { deploy, log } = deployments
  const { deployer } = await getNamedAccounts()

  // const chainId = network.config.chainId
  // if(chainId === 31337) ...

  if (developmentChains.includes(network.name)) {
    log("local network detected! Deploying mocks...")

    // we import mock contract from their github to contracts/test
    // and then we deploy that contract to be our mock
    await deploy("VRFCoordinatorV2Mock", {
      from: deployer,
      log: true,
      args: args,
    })
    log("mocks deployed")
    log("--------------------------------------------------")
  }
}

module.exports.tags = ["all", "mocks"]
