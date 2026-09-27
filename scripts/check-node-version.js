import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import { satisfies } from 'semver';

const packageJsonPath = join(process.cwd(), 'package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

const requiredNodeVersion = packageJson.engines?.node;
const actualNodeVersion = process.version;

if (!requiredNodeVersion) {
  console.error(chalk.red('Error: package.json is missing a required engines.node version range.'));
  process.exit(1);
}

if (!satisfies(actualNodeVersion, requiredNodeVersion)) {
  console.error(
    chalk.red(
      `Error: Your Node.js version ${chalk.bgRed(chalk.white(actualNodeVersion))} is not compatible with this application. ` +
        `Please upgrade to version ${chalk.bgGreen(chalk.white(requiredNodeVersion))} or higher.`
    )
  );
  process.exit(1);
}
