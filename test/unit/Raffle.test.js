const { assert } = require("chai")
const { getNamedAccounts, deployments, ethers, network } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Raffle Unit Tests", async function () {
      let raffle, vrfCoordinatorV2Mock
      const chainId = network.config.chainId

      beforeEach(async function () {
        const { deployer } = await getNamedAccounts()
        await deployments.fixture(["all"]) //all is a tag we specified in deploy scripts
        raffle = await ethers.getContract("Raffle", deployer)
      })

      describe("constructor", async function () {
        it("initializes raffle contract correctly", async function () {
          // ideally all this would be in separate with one assert per it
          const raffleState = await raffle.getRaffleState()
          const interval = await raffle.getInterval()
          assert.equal(raffleState.toString(), "0")
          assert.equal(interval.toString, networkConfig[chainId]["interval"])
        })
      })
    })
