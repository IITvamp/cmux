import fs from 'fs';
import path from 'path';

const projectRoot = path.resolve(__dirname, '..');
const uploadArtifactDir = path.join(projectRoot, 'upload-artifact');

interface SecurityIssue {
  type: 'env_file' | 'secret' | 'sensitive_file' | 'suspicious_content';
  file: string;
  line?: number;
  content?: string;
  pattern?: string;
}

function checkUploadArtifact(): void {
  console.log('🔍 Running comprehensive security scan on upload-artifact...\n');
  
  if (!fs.existsSync(uploadArtifactDir)) {
    console.error('❌ ERROR: upload-artifact directory does not exist');
    console.error('   Run "npm run prepare-publish" first');
    process.exit(1);
  }
  
  const issues: SecurityIssue[] = [];
  let totalFilesScanned = 0;
  let totalBytesScanned = 0;
  
  // Patterns for files that should NEVER be in a published package
  const forbiddenFilePatterns = [
    /\.env/i,
    /\.pem$/,
    /\.key$/,
    /\.cert$/,
    /\.crt$/,
    /\.p12$/,
    /\.pfx$/,
    /id_rsa/,
    /id_dsa/,
    /id_ecdsa/,
    /id_ed25519/,
    /\.ssh\//,
    /\.gnupg\//,
    /\.aws\//,
    /\.git\//,
    /\.vscode\//,
    /\.idea\//,
    /\.DS_Store$/,
    /Thumbs\.db$/,
    /\.local$/,
    /\.private$/,
    /credentials/i,
    /secrets/i,
    /private.*key/i,
    /\.log$/,
    /\.tmp$/,
    /\.temp$/,
    /\.cache/,
    /node_modules/,
    /\.test$/,
    /\.spec\./
  ];
  
  // Content patterns to search for in ALL file types
  const secretPatterns = [
    // High confidence patterns
    { pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"]([a-zA-Z0-9_\-]{20,})['"]/, name: 'API Key' },
    { pattern: /(?:secret|token)\s*[:=]\s*['"]([a-zA-Z0-9_\-]{20,})['"]/, name: 'Secret/Token' },
    { pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"]([^'"]+)['"]/, name: 'Password' },
    { pattern: /AKIA[0-9A-Z]{16}/, name: 'AWS Access Key' },
    { pattern: /(?:aws[_-]?secret[_-]?access[_-]?key)\s*[:=]\s*['"]([^'"]+)['"]/, name: 'AWS Secret' },
    { pattern: /ghp_[a-zA-Z0-9]{36}/, name: 'GitHub Personal Token' },
    { pattern: /gho_[a-zA-Z0-9]{36}/, name: 'GitHub OAuth Token' },
    { pattern: /ghs_[a-zA-Z0-9]{36}/, name: 'GitHub App Token' },
    { pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/, name: 'Private Key' },
    { pattern: /(?:mongodb|postgres|mysql|redis):\/\/[^:]+:[^@]+@[^\/]+/, name: 'Database URL with credentials' },
    { pattern: /jwt[_-]?secret\s*[:=]\s*['"]([^'"]{10,})['"]/, name: 'JWT Secret' },
    { pattern: /sk_(?:test|live)_[a-zA-Z0-9]{24,}/, name: 'Stripe Secret Key' },
    { pattern: /SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/, name: 'SendGrid API Key' },
    { pattern: /xox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24,}/, name: 'Slack Token' },
    
    // Medium confidence patterns
    { pattern: /bearer\s+[a-zA-Z0-9_\-\.]{20,}/, name: 'Bearer Token', confidence: 'medium' },
    { pattern: /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i, name: 'UUID (potential secret)', confidence: 'medium' },
    
    // Environment variable references that might indicate missing substitution
    { pattern: /process\.env\.[A-Z_]+/, name: 'Environment variable reference', confidence: 'info' },
    { pattern: /\$\{[A-Z_]+\}/, name: 'Unsubstituted variable', confidence: 'info' }
  ];
  
  // Additional suspicious patterns
  const suspiciousPatterns = [
    { pattern: /localhost:\d+/, name: 'Localhost URL' },
    { pattern: /127\.0\.0\.1/, name: 'Local IP' },
    { pattern: /192\.168\.\d+\.\d+/, name: 'Private IP' },
    { pattern: /10\.\d+\.\d+\.\d+/, name: 'Private IP' },
    { pattern: /172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+/, name: 'Private IP' },
    { pattern: /\/Users\/[^\/]+\//, name: 'User home directory path' },
    { pattern: /\/home\/[^\/]+\//, name: 'User home directory path' },
    { pattern: /C:\\Users\\[^\\]+\\/, name: 'Windows user path' }
  ];
  
  function scanFile(filePath: string, relativePath: string): void {
    totalFilesScanned++;
    const stats = fs.statSync(filePath);
    totalBytesScanned += stats.size;
    
    // Check filename against forbidden patterns
    for (const pattern of forbiddenFilePatterns) {
      if (pattern.test(relativePath)) {
        issues.push({
          type: 'sensitive_file',
          file: relativePath,
          pattern: pattern.toString()
        });
      }
    }
    
    // Read and scan file contents (for ALL file types)
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        // Check for secrets
        for (const secretPattern of secretPatterns) {
          const match = line.match(secretPattern.pattern);
          if (match) {
            // Skip if it's clearly a placeholder or example
            if (line.includes('process.env') || 
                line.includes('${') || 
                match[0].includes('xxxx') ||
                match[0].includes('****') ||
                match[0].includes('<') ||
                match[0].includes('YOUR_') ||
                match[0].includes('REPLACE_') ||
                match[0].includes('example') ||
                match[0].includes('EXAMPLE')) {
              if (secretPattern.confidence !== 'info') {
                continue;
              }
            }
            
            issues.push({
              type: 'secret',
              file: relativePath,
              line: index + 1,
              content: line.trim().substring(0, 100),
              pattern: secretPattern.name
            });
          }
        }
        
        // Check for suspicious content
        for (const suspicious of suspiciousPatterns) {
          if (suspicious.pattern.test(line)) {
            issues.push({
              type: 'suspicious_content',
              file: relativePath,
              line: index + 1,
              content: line.trim().substring(0, 100),
              pattern: suspicious.name
            });
          }
        }
      });
      
      // Binary file detection
      if (content.includes('\0')) {
        console.warn(`⚠️  Binary file detected: ${relativePath}`);
      }
      
    } catch (err) {
      // If we can't read as text, it might be binary
      console.warn(`⚠️  Could not read file as text: ${relativePath}`);
    }
  }
  
  function scanDirectory(dir: string, baseDir: string = dir): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(baseDir, fullPath);
      
      if (entry.isDirectory()) {
        scanDirectory(fullPath, baseDir);
      } else if (entry.isFile()) {
        scanFile(fullPath, relativePath);
      }
    }
  }
  
  // Scan the upload-artifact directory
  console.log(`📂 Scanning directory: ${uploadArtifactDir}\n`);
  scanDirectory(uploadArtifactDir, uploadArtifactDir);
  
  // Report results
  console.log(`📊 Scan complete:`);
  console.log(`   Files scanned: ${totalFilesScanned}`);
  console.log(`   Total size: ${(totalBytesScanned / 1024 / 1024).toFixed(2)} MB\n`);
  
  if (issues.length > 0) {
    // Group issues by severity
    const criticalIssues = issues.filter(i => i.type === 'secret' || i.type === 'sensitive_file');
    const warningIssues = issues.filter(i => i.type === 'suspicious_content');
    
    if (criticalIssues.length > 0) {
      console.error('❌ CRITICAL SECURITY ISSUES FOUND\n');
      
      const fileIssues = criticalIssues.filter(i => i.type === 'sensitive_file');
      if (fileIssues.length > 0) {
        console.error('🚨 Sensitive files detected:');
        fileIssues.forEach(issue => {
          console.error(`   ❌ ${issue.file}`);
        });
        console.error('');
      }
      
      const secretIssues = criticalIssues.filter(i => i.type === 'secret');
      if (secretIssues.length > 0) {
        console.error('🔐 Potential secrets found:');
        secretIssues.forEach(issue => {
          console.error(`   ❌ ${issue.file}:${issue.line} - ${issue.pattern}`);
          console.error(`      ${issue.content}`);
        });
        console.error('');
      }
      
      console.error('⛔ DO NOT PUBLISH THIS PACKAGE!');
      console.error('\n📋 Required actions:');
      console.error('   1. Remove all sensitive files');
      console.error('   2. Replace hardcoded secrets with environment variables');
      console.error('   3. Re-run "npm run prepare-publish"');
      console.error('   4. Run this security check again\n');
      
      process.exit(1);
    }
    
    if (warningIssues.length > 0) {
      console.warn('⚠️  Warnings found:\n');
      warningIssues.forEach(issue => {
        console.warn(`   ⚠️  ${issue.file}:${issue.line} - ${issue.pattern}`);
        console.warn(`      ${issue.content}`);
      });
      console.warn('\nThese might be intentional, but please review before publishing.\n');
    }
  } else {
    console.log('✅ Security scan passed!');
    console.log('✅ No sensitive files or secrets detected');
    console.log('✅ Package appears safe to publish\n');
    console.log('📦 To publish: cd upload-artifact && npm publish');
  }
}

// Run the check
checkUploadArtifact();