const { id } = require("ethers/lib/utils")
const { network, ethers, deployments } = require("hardhat")
const { developmentChains, networkConfig } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")

const VRF_SUBSCRIPTION_FUND_AMOUNT = ethers.utils.parseEther("2")

module.exports = async function ({ getNamedAccounts, deployments }) {
  const { deploy, log } = deployments
  const { deployer } = await getNamedAccounts()
  // can use this instead of deployer
  // let owner = await ethers.getSigners()
  // log(owner.address)
  let vrfCoordinatorV2Address, subscriptionId
  const chainId = network.config.chainId

  if (developmentChains.includes(network.name)) {
    // FIRST WAY: doesn't actually work
    // i think it can also be like this if there were deployments
    // const vrfCoordinatorV2Mock = await deployments.get("VRFCoordinatorV2Mock")
    // log(vrfCoordinatorV2Mock)
    // difference is when we get it with method above we get functions in bytecode so we can't call them directly
    // with method below we can because everything is decoded

    // SECOND WAY: best
    const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
    vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address
    // log(vrfCoordinatorV2Mock)

    // THIRD WAY: that works (first doesn't work that well)
    // const vrfcf = await ethers.getContractFactory("VRFCoordinatorV2Mock")
    // const con = await deployments.get("VRFCoordinatorV2Mock")
    // const vrfCoordinatorV2Mock = vrfcf.attach(con.address)
    // vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address

    //creating subscription
    const transactionResponse = await vrfCoordinatorV2Mock.createSubscription()
    const trasactionReceipt = await transactionResponse.wait(1) //inside transactionReceipt there is event that is emited with subscription
    subscriptionId = trasactionReceipt.events[0].args.subId

    // Fund the subscription
    // Mocks can be funded with other assets than LINK token
    await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, VRF_SUBSCRIPTION_FUND_AMOUNT)
  } else {
    vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"]

    // here we could fund it like in code above, but we used ui for this and put subscriptionId in helper config
    subscriptionId = networkConfig[chainId]["subscriptionId"]
  }

  const entranceFee = networkConfig[chainId]["entranceFee"]
  const gasLane = networkConfig[chainId]["gasLane"]
  const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"]
  const interval = networkConfig[chainId]["interval"]

  const args = [
    vrfCoordinatorV2Address,
    entranceFee,
    gasLane,
    subscriptionId,
    callbackGasLimit,
    interval,
  ]

  const raffle = await deploy("Raffle", {
    from: deployer,
    args: args,
    log: true,
    waitConfirmations: network.config.blockConfirmations || 1,
  })

  // log(deployer)
  // const Raffle = await ethers.getContractFactory("Raffle")
  // const raffle = await Raffle.deploy(
  //   vrfCoordinatorV2Address,
  //   entranceFee,
  //   gasLane,
  //   subscriptionId,
  //   callbackGasLimit,
  //   interval
  // )
  // await raffle.deployed()
  // for some reason when deploying contract like this, i can't use deployments.fixture in testing
  // i assume that doing it the way docks said would work, with creating loadFixture() but i didn't try it

  log("Dployed contract:")
  log(raffle.address)
  // log(raffle)

  if (developmentChains.includes(network.name)) {
    const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
    await vrfCoordinatorV2Mock.addConsumer(subscriptionId, raffle.address)
    log("Deployed contract added as mock consumer")
    // const data = await vrfCoordinatorV2Mock.getSubscription(subscriptionId)
    // log(data.consumers)
  }

  if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
    log("------------------------------------------------------------")
    await verify(raffle.address, args)
  }
  log("------------------------------------------------------------")
}

module.exports.tags = ["all", "raffle"]
