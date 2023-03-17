const { assert, expect } = require("chai")
const { getNamedAccounts, deployments, ethers, network } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
  ? describe.skip
  : describe("Raffle Unit Tests", function () {
      let raffle, vrfCoordinatorV2Mock, raffleEntranceFee, deployer, interval
      const chainId = network.config.chainId

      beforeEach(async function () {
        // can also be done this way:
        // accounts = await ethers.getSigners()
        // player = accounts[1]
        // raffleContract = await ethers.getContract("Raffle") // Returns a new connection to the Raffle contract
        // raffle = raffleContract.connect(player) // Returns a new instance of the Raffle contract connected to player

        // const { deployer } = await getNamedAccounts() // commented out becaus we need it globaly
        deployer = (await getNamedAccounts()).deployer //this way we cant get balance, with getSigners we can
        await deployments.fixture(["all"]) //all is a tag we specified in deploy scripts
        raffle = await ethers.getContract("Raffle", deployer) //deployer is to link deployer to contract, not necessary
        // console.log(raffle)
        vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
        raffleEntranceFee = await raffle.getEnrtanceFee()
        interval = await raffle.getInterval()
      })

      describe("constructor", function () {
        it("initializes raffle contract correctly", async function () {
          // ideally all this would be in separate with one assert per it
          const raffleState = await raffle.getRaffleState()
          assert.equal(raffleState.toString(), "0")
          assert.equal(interval.toString(), networkConfig[chainId]["interval"])
        })
      })

      describe("enterRaffle", function () {
        it("reverts when you don't pay enough", async function () {
          await expect(raffle.enterRaffle()).to.be.revertedWith("Raffle__NotEnoughETHEneterd")
        })

        it("records players when they enter", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee }) //we are connected to a deployer
          const playerFromContract = await raffle.getPlayer(0)
          assert.equal(playerFromContract, deployer)
        })

        it("emits event on enter", async function () {
          await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.emit(
            raffle,
            "RaffleEnter"
          )
        })

        it("doesn't allow entrance when raffle is calculating", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee })
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.send("evm_mine", []) //just to mine 1 extra block
          // await network.provider.request({method: "evm_mine", params: {}})  // same as line above

          // we have done everytnig to make sure chechUpkeep would return upkeepNeeded = true
          // so now we pretend to be chainlink node and call performUpkeep
          await raffle.performUpkeep([])
          await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.be.revertedWith(
            "Raffle__NotOpen"
          )
        })
      })

      describe("chechUpkeep", function () {
        it("returns false if people have't sent eny ETH", async function () {
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.send("evm_mine", [])
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]) //callStatic simulates calling a function instead of making transaction
          assert(!upkeepNeeded)
        })

        it("returns false if raffle isn't open", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee })
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.send("evm_mine", []) //blank bytes object can also be sent like this "0x" instead of []
          await raffle.performUpkeep([])
          const raffleState = await raffle.getRaffleState()
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([])
          assert.equal(raffleState.toString(), "1")
          assert.equal(upkeepNeeded, false)
        })

        it("returns false if enough time hasn't passed", async () => {
          await raffle.enterRaffle({ value: raffleEntranceFee })
          await network.provider.send("evm_increaseTime", [interval.toNumber() - 5]) // use a higher number here if this test fails
          await network.provider.request({ method: "evm_mine", params: [] })
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
          assert(!upkeepNeeded)
        })

        it("returns true if enough time has passed, has players, eth, and is open", async () => {
          await raffle.enterRaffle({ value: raffleEntranceFee })
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.request({ method: "evm_mine", params: [] })
          const { upkeepNeeded } = await raffle.callStatic.checkUpkeep("0x") // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
          assert(upkeepNeeded)
        })
      })

      describe("performUpkeep", function () {
        it("can only run if checkUpkeep is true", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee })
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.send("evm_mine", [])
          const tx = await raffle.performUpkeep([])
          assert(tx) //if tx doesn't return or some exception is made this will fail
        })

        it("reverts when checkUpkeep is false", async function () {
          await expect(raffle.performUpkeep([])).to.be.revertedWith("Raffle__UpkeepNotNeeded")
        })

        it("updated the raffle stae, emits the event and calls the vrf coordinator", async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee })
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.send("evm_mine", [])
          const txResponse = await raffle.performUpkeep([])
          const txReceipt = await txResponse.wait(1)
          const requestId = txReceipt.events[1].args.requestId
          const raffleState = await raffle.getRaffleState()
          assert(requestId.toNumber() > 0)
          assert(raffleState.toString() == "1")
        })
      })

      describe("fullfill random words", function () {
        // another before each
        // both will be executed
        beforeEach(async function () {
          await raffle.enterRaffle({ value: raffleEntranceFee })
          await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
          await network.provider.send("evm_mine", [])
        })

        it("can only be called after performUpkeep", async function () {
          await expect(
            vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address)
          ).to.be.revertedWith("nonexistent request")
          await expect(
            vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.address)
          ).to.be.revertedWith("nonexistent request")
        })

        it("picks a winner, resets the lottery and sends the mmoney", async function () {
          // look this test on github
          const additionalEntrances = 3
          const startingAccountIndex = 2 //deployer is 0
          const accounts = await ethers.getSigners()
          for (let i = startingAccountIndex; i < startingAccountIndex + additionalEntrances; i++) {
            const accountConnectedRaffle = raffle.connect(accounts[i])
            await accountConnectedRaffle.enterRaffle({ value: raffleEntranceFee })
          }
          const startingTimeStamp = await raffle.getLatestTimeStamp()

          await new Promise(async (resolve, reject) => {
            raffle.once("WinnerPicked", async () => {
              console.log("Found the event!")
              try {
                console.log("Participants in raffle:")
                console.log(accounts[0].address)
                console.log(accounts[2].address)
                console.log(accounts[3].address)
                console.log(accounts[4].address)
                const recentWinner = await raffle.getRecentWinner()
                console.log(`Winner is ${recentWinner}`)
                const raffleState = await raffle.getRaffleState()
                const endingTimeStamp = await raffle.getLatestTimeStamp()
                const numberOfPlayers = await raffle.getNumberOfPlayers()
                const winnerBalance = await accounts[2].getBalance()
                assert.equal(numberOfPlayers.toString(), "0")
                assert.equal(raffleState.toString(), "0")
                assert(endingTimeStamp > startingTimeStamp)
                assert.equal(recentWinner.toString(), accounts[2].address)
                assert.equal(
                  winnerBalance.toString(),
                  startingBalance // startingBalance + ( (raffleEntranceFee * additionalEntrances) + raffleEntranceFee )
                    .add(raffleEntranceFee.mul(additionalEntrances).add(raffleEntranceFee))
                    .toString()
                )
                resolve()
              } catch (error) {
                reject(error)
              }
            })
            const tx = await raffle.performUpkeep([])
            // console.log(tx)
            const txReciept = await tx.wait(1)
            // console.log(txReciept)

            const startingBalance = await accounts[2].getBalance()
            // winner is always first player because can't successfully imitate chainlink vrf funcitonalities, we can just pretend

            await vrfCoordinatorV2Mock.fulfillRandomWords(
              txReciept.events[1].args.requestId,
              raffle.address
            )
          })
        })
      })
    })
