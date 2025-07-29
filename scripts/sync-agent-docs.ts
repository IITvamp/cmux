#!/usr/bin/env bun
import { existsSync, copyFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Define agent documentation file mappings
const AGENT_DOCS = {
  'CLAUDE.md': ['CLAUDE.md'],
  'AGENTS.md': ['AGENTS.md', 'OPENAI.md', 'GPT.md'],
  'GEMINI.md': ['GEMINI.md'],
  'CODEX.md': ['CODEX.md'],
  'OPENCODE.md': ['OPENCODE.md'],
  'AMP.md': ['AMP.md']
};

// Get all possible source files
const ALL_SOURCE_FILES = Object.keys(AGENT_DOCS);

// Get all possible target files
const ALL_TARGET_FILES = Object.values(AGENT_DOCS).flat();

function syncAgentDocs(rootDir: string = '.') {
  // Find which source file exists
  let sourceFile: string | null = null;
  let sourceContent: string | null = null;
  
  for (const file of ALL_SOURCE_FILES) {
    const filePath = join(rootDir, file);
    if (existsSync(filePath)) {
      sourceFile = file;
      sourceContent = readFileSync(filePath, 'utf-8');
      console.log(`Found source file: ${file}`);
      break;
    }
  }
  
  if (!sourceFile || !sourceContent) {
    console.log('No agent documentation files found. Nothing to sync.');
    return;
  }
  
  // Determine which files to create based on the source
  let targetFiles: string[] = [];
  
  // If source is one of the specific agent docs, copy to all relevant targets
  if (AGENT_DOCS[sourceFile]) {
    targetFiles = AGENT_DOCS[sourceFile];
  }
  
  // Also check if we should create other agent files based on generic AGENTS.md
  if (sourceFile === 'AGENTS.md' || sourceFile === 'CLAUDE.md') {
    // When we have a generic or Claude file, we might want to copy to all agents
    targetFiles = [...new Set([...targetFiles, ...ALL_TARGET_FILES])];
  }
  
  // Copy to all target files
  let copiedCount = 0;
  for (const target of targetFiles) {
    if (target === sourceFile) continue; // Don't copy to self
    
    const targetPath = join(rootDir, target);
    
    // Check if target already exists
    if (existsSync(targetPath)) {
      console.log(`Skipping ${target} - already exists`);
      continue;
    }
    
    try {
      copyFileSync(join(rootDir, sourceFile), targetPath);
      console.log(`Copied ${sourceFile} to ${target}`);
      copiedCount++;
    } catch (error) {
      console.error(`Failed to copy to ${target}:`, error);
    }
  }
  
  if (copiedCount > 0) {
    console.log(`\nSuccessfully synchronized ${copiedCount} agent documentation files.`);
  } else {
    console.log('\nNo files needed to be synchronized.');
  }
}

// Run the sync
if (import.meta.main) {
  syncAgentDocs();
}

export { syncAgentDocs };