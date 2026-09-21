const fs = require('fs');
const path = require('path');

const backendDir = 'c:/Users/jdzul/OneDrive/Documents/Agente-Bussiness-Back/mantenere-backend';
const controllerPath = path.join(backendDir, 'app/Http/Controllers/Api/TrabajoController.php');

if (fs.existsSync(controllerPath)) {
    const content = fs.readFileSync(controllerPath, 'utf8');
    const lines = content.split('\n');
    const showIdx = lines.findIndex(l => l.includes('function show('));
    if (showIdx !== -1) {
        console.log("=== TrabajoController.show ===");
        console.log(lines.slice(showIdx, showIdx + 40).join('\n'));
    }
}
