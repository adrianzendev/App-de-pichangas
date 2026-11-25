// Debug script para verificar el sistema de precios dinámicos
console.log('🔍 DEBUG: Verificando sistema de precios...');

// Test the price detection function
const testMessage = "💰 Nueva cotización: S/.21\nHe revisado los detalles de tu tarea y actualizo mi presupuesto. Este precio incluye todo lo necesario para completar tu proyecto con la calidad que mereces.";

const pricePatterns = [
    /💰.*?S\/\.(\d+(?:\.\d{2})?)/i,
    /Mi cotización.*?S\/\.(\d+(?:\.\d{2})?)/i,
    /Nueva cotización.*?S\/\.(\d+(?:\.\d{2})?)/i,
    /cotización.*?S\/\.(\d+(?:\.\d{2})?)/i,
    /S\/\.(\d+(?:\.\d{2})?)/i
];

console.log('📝 Mensaje de test:', testMessage);

for (let i = 0; i < pricePatterns.length; i++) {
    const pattern = pricePatterns[i];
    const match = testMessage.match(pattern);
    if (match && match[1]) {
        console.log(`✅ Patrón ${i+1} detectó: S/.${match[1]}`);
    } else {
        console.log(`❌ Patrón ${i+1} no detectó precio`);
    }
}

// Check if the backend API is working
fetch('/api/chat/last-messages', { credentials: 'include' })
    .then(response => response.json())
    .then(data => {
        console.log('🌐 API Response:', data);
        
        const targetKey = 'dd5003b1-4a0c-4393-af29-c54563a78e4e-3c50b7d4-a477-43e6-b578-49c160b13536';
        if (data[targetKey]) {
            const message = data[targetKey].message;
            console.log('🎯 Mensaje objetivo:', message);
            
            const priceMatch = message.match(/💰.*?S\/\.(\d+(?:\.\d{2})?)/i);
            if (priceMatch) {
                console.log('💰 PRECIO DETECTADO EN API:', priceMatch[1]);
            } else {
                console.log('❌ No se detectó precio en mensaje de API');
            }
        } else {
            console.log('❌ Conversación objetivo no encontrada');
            console.log('🔑 Keys disponibles:', Object.keys(data));
        }
    })
    .catch(error => {
        console.error('❌ Error al llamar API:', error);
    });