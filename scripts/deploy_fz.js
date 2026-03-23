const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("--------------------------------------------------");
  console.log("System Deploying FinzoToken (FZ) to Internal Network");
  console.log("Deployer Address:", deployer.address);
  console.log("--------------------------------------------------");

  const FinzoToken = await hre.ethers.getContractFactory("FinzoToken");
  const fz = await FinzoToken.deploy(deployer.address);

  await fz.waitForDeployment();

  const fzAddress = await fz.getAddress();
  console.log("SUCCESS: FinzoToken (FZ) deployed at:", fzAddress);
  console.log("--------------------------------------------------");
  console.log("Next steps:");
  console.log("1. Add FZ to MetaMask (Import Token)");
  console.log("2. Use Address:", fzAddress);
  console.log("3. Visit Dashboard -> Blockchain Explorer to interact.");
  console.log("--------------------------------------------------");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
