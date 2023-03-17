const { assert, expect } = require("chai")
const { getNamedAccounts, ethers, network } = require("hardhat")
const { isCallTrace } = require("hardhat/internal/hardhat-network/stack-traces/message-trace")
const { developmentChains } = require("../../helper-hardhat-config")

developmentChains.includes(network.name)
  ? describe.skip
  : describe("Raffle Staging Tests", function () {
      let raffle, raffleEntranceFee, deployer

      beforeEach(async function () {
        deployer = (await getNamedAccounts()).deployer
        raffle = await ethers.getContract("Raffle", deployer)
        raffleEntranceFee = await raffle.getEnrtanceFee()
      })
      describe("fulfillRandomWords", function () {
        it("works with live Chainlink Keepers and Chainlink VRF, we get a random winner", async function () {
          const startingTimeStamp = await raffle.getLatestTimeStamp()
          const accounts = await ethers.getSigners()

          //   setup the listener before we enter the raffle, in case blockchain moves really fast
          await new Promise(async (resolve, reject) => {
            raffle.once("WinnerPicked", async () => {
              console.log("WinnerPicked event fired")
              try {
                const recentWinner = await raffle.getRecentWinner()
                console.log(recentWinner)
                const raffleState = await raffle.getRaffleState()
                const winnerEndingBalance = await accounts[0].getBalance()
                const endingTimeStamp = await raffle.getLatestTimeStamp()

                assert.equal(recentWinner.toString(), accounts[0].address) //we know first account will be winner because its the only one that entered
                await expect(raffle.getPlayer(0)).to.be.reverted
                assert.equal(raffleState, 0)
                assert(endingTimeStamp > startingTimeStamp)
                assert.equal(
                  winnerEndingBalance.toString(),
                  winnerStartingBalance.add(raffleEntranceFee).toString()
                )
                resolve()
              } catch (error) {
                reject(error)
              }
            })
            const tx = await raffle.enterRaffle({ value: raffleEntranceFee })
            await tx.wait(1)
            const winnerStartingBalance = await accounts[0].getBalance()
          })
        })
      })
    })
