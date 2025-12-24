import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { diffLines } from 'diff';
import chalk from 'chalk';
class Groot {
  constructor(repoPath = '.') {
    this.repoPath = path.join(repoPath, '.groot');
    this.objectsPath = path.join(this.repoPath, 'objects'); // .groot/objects
    this.headPath = path.join(this.repoPath, 'HEAD'); // .groot/HEAD
    this.indexPath = path.join(this.repoPath, 'index'); // .groot/index
    this.init();
  }

  async init() {
    await fs.mkdir(this.objectsPath, { recursive: true });
    try {
      await fs.writeFile(this.headPath, '', { flag: 'wx' }); // wx: open for writing, fails if file exists
      await fs.writeFile(this.indexPath, JSON.stringify([]), { flag: 'wx' });
    } catch (error) {
      console.log("Already initialised the .groot folder");
    }
  }
  hashObject(content) {
    return crypto.createHash('sha1').update(content, 'utf-8').digest('hex');
  }

  async add(fileToBeAdded) {
    const fileData = await fs.readFile(fileToBeAdded, { encoding: 'utf-8' });
    const fileHash = this.hashObject(fileData);
    console.log(fileHash);
    const newFileHashedObjectPath = path.join(this.objectsPath, fileHash);
    await fs.writeFile(newFileHashedObjectPath, fileData);
    //one step missing :add the file to staging are
    await this.updateStagingArea(fileToBeAdded, fileHash);
    console.log(`Added file ${fileToBeAdded} `);
  }

  async updateStagingArea(filePath, fileHash) {
    const index = JSON.parse(await fs.readFile(this.indexPath, { encoding: 'utf-8' })); // read the index file
    index.push({ filePath, fileHash }); // add the file to the index
    await fs.writeFile(this.indexPath, JSON.stringify(index)); // write the updated index file
  }

  async commit(message) {
    const index = JSON.parse(await fs.readFile(this.indexPath, { encoding: 'utf-8' }));
    const parentCommit = await this.getCurrentHead();
    const commitData = {
      message,
      timestamp: new Date().toISOString(),
      files: index,
      parent: parentCommit
    };
    const commitHash = this.hashObject(JSON.stringify(commitData));
    const commitPath = path.join(this.objectsPath, commitHash);
    await fs.writeFile(commitPath, JSON.stringify(commitData)); // update the HEAD to point to the new commit
    await fs.writeFile(this.headPath, commitHash);
    await fs.writeFile(this.indexPath, JSON.stringify([])); // clear the staging area
    console.log(`Committ successfully created with hash: ${commitHash}`);
  }
  async getCurrentHead() {
    try {
      const headHash = await fs.readFile(this.headPath, { encoding: 'utf-8' });
      return headHash || null;
    } catch (error) {
      return null;
    }
  }

  async log() {
    let currentCommitHash = await this.getCurrentHead();

    while (currentCommitHash) {
      const commitData = JSON.parse(await fs.readFile(path.join(this.objectsPath, currentCommitHash), { encoding: 'utf-8' }));
      console.log(`-----------\n`)
      console.log(`Commit: ${currentCommitHash}`);
      console.log(`Date: ${commitData.timestamp}`);
      console.log(`Message: ${commitData.message}\n`);
      currentCommitHash = commitData.parent;
    }
  }

  async showCommitDiff(commitHash) {
    const commitData = await this.gitCommitData(commitHash);
    if (!commitData) {
      console.log(`Commit with hash ${commitHash} not found.`);
      return;
    }
    console.log(`Diff for commit ${commitHash}:`);
    for (const file of commitData.files) {
      console.log(`File: ${file.filePath}`);   // ✅ correct
      const fileContent = await this.getFileContent(file.fileHash); // ✅ correct
      console.log(fileContent);
      if (commitData.parent) {
        const parentCommitData = await this.gitCommitData(commitData.parent);

        const getparentFileContent = await this.getParentFileContent(parentCommitData, file.filePath);
        if (getparentFileContent !== undefined) {
          console.log(`\nDiff`);
          const diff = diffLines(getparentFileContent, fileContent);
          console.log(diff);
          diff.forEach(part => {
            if (part.added) {
              process.stdout.write(chalk.green(part.value));
            }
            else if (part.removed) {
              process.stdout.write(chalk.red(part.value));
            }
            else {
              process.stdout.write(chalk.gray(part.value));
            }
          });
          console.log();
        }
        else {
          console.log("No parent file content found for diff.");
        }
      } else {
        console.log("No parent commit to diff against.");
      }

    }
  }

  async getParentFileContent(parentCommitData, filePath) {
    const parentFile = parentCommitData.files.find(f => f.filePath === filePath);

    if (parentFile) {
      return await this.getFileContent(parentFile.fileHash);
    }

  }
  async gitCommitData(commitHash) {
    const commitPath = path.join(this.objectsPath, commitHash);
    try {
      const commitData = JSON.parse(await fs.readFile(commitPath, { encoding: 'utf-8' }));
      return commitData;
    } catch (error) {
      console.error(`Commit with hash ${commitHash} not found.${error}`);
      return null;
    }
  }

  async getFileContent(fileHash) {
    const objectPath = path.join(this.objectsPath, fileHash);
    return fs.readFile(objectPath, { encoding: 'utf-8' });

  }
}


(async () => {
  console.log("Groot is initialising");


  const groot = new Groot();
  // await groot.add('sample.txt');
  // await groot.commit('Fourth commit');
  // await groot.log();
  await groot.showCommitDiff('480fc8ae9f7871a97e9aa32a65de654af3be09d5');
})();