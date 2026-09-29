import * as path from "path";
import { runTests } from "@vscode/test-electron";

// Launches a real VS Code with the extension and the test-fixtures/workspace folder, then runs ./suite.
async function main(): Promise<void> {
  // A terminal inside VS Code inherits variables that would make the test instance start as plain Node.
  for (const name of Object.keys(process.env)) {
    if (name === "ELECTRON_RUN_AS_NODE" || name.startsWith("VSCODE_")) delete process.env[name];
  }
  const root = path.resolve(__dirname, "..", "..");
  await runTests({
    extensionDevelopmentPath: root,
    extensionTestsPath: path.join(__dirname, "suite"),
    launchArgs: [path.join(root, "test-fixtures", "workspace"), "--disable-extensions"],
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
