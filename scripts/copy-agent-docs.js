#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// List of agent names to create documentation for
const agentNames = ['CLAUDE', 'GEMINI', 'OPENAI', 'AGENTS', 'CODEX', 'AMP', 'OPENCODE'];

// Function to copy content from source to destination
function copyContent(source, destination) {
  if (fs.existsSync(source)) {
    const content = fs.readFileSync(source, 'utf8');
    fs.writeFileSync(destination, content);
    console.log(`Copied ${source} to ${destination}`);
    return true;
  }
  return false;
}

// Function to find existing agent file
function findExistingAgentFile() {
  for (const agent of agentNames) {
    const fileName = `${agent}.md`;
    if (fs.existsSync(fileName)) {
      return fileName;
    }
  }
  return null;
}

// Main function
function main() {
  // Find existing agent file
  const existingFile = findExistingAgentFile();
  
  if (!existingFile) {
    console.log('No existing agent file found. Creating default AGENTS.md');
    // Create a basic AGENTS.md if none exists
    const defaultContent = '# Agent Documentation\n\nThis project supports multiple coding agents.';
    fs.writeFileSync('AGENTS.md', defaultContent);
    console.log('Created default AGENTS.md');
  } else {
    console.log(`Found existing agent file: ${existingFile}`);
    
    // Copy to all agent names
    for (const agent of agentNames) {
      const destination = `${agent}.md`;
      if (destination !== existingFile && !fs.existsSync(destination)) {
        copyContent(existingFile, destination);
      }
    }
  }
  
  console.log('Agent documentation setup complete.');
}

main();