const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('=== NebulaChat Application Setup ===');

const setupEnvFile = () => {
  console.log('\n📝 Setting up environment variables...');
  
  rl.question('Enter your Supabase URL: ', (supabaseUrl) => {
    rl.question('Enter your Supabase Anon Key: ', (supabaseKey) => {
      const envContent = `NEXT_PUBLIC_SUPABASE_URL=${supabaseUrl}\nNEXT_PUBLIC_SUPABASE_ANON_KEY=${supabaseKey}`;
      
      fs.writeFile(path.join(__dirname, '.env.local'), envContent, (err) => {
        if (err) {
          console.error('❌ Error creating .env.local file:', err);
        } else {
          console.log('✅ Created .env.local file successfully!');
        }
        
        console.log('\n📋 Next steps:');
        console.log('1. Run the SQL script from enhanced_database_structure.sql in your Supabase SQL editor');
        console.log('2. Start the development server with: npm run dev');
        console.log('3. Open http://localhost:3000 in your browser');
        
        rl.close();
      });
    });
  });
};

// Check if .env.local already exists
if (fs.existsSync(path.join(__dirname, '.env.local'))) {
  rl.question('\n⚠️ .env.local file already exists. Overwrite it? (y/n): ', (answer) => {
    if (answer.toLowerCase() === 'y') {
      setupEnvFile();
    } else {
      console.log('⏭️ Skipping environment setup.');
      rl.close();
    }
  });
} else {
  setupEnvFile();
} 