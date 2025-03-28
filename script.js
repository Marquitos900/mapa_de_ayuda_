// Mapa centrado en Reynosa
const map = L.map('map').setView([26.0806, -98.2884], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
}).addTo(map);

// Conectar a Supabase
const SUPABASE_URL = 'https://gpgcmfuznkcjgzmrqnuy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwZ2NtZnV6bmtjamd6bXJxbnV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMxMzg4NDgsImV4cCI6MjA1ODcxNDg0OH0.ok-71wvjKb2-SDLJm75I0fMS_wD71jom36-S4pj1xcI';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Mostrar marcador en el mapa
function addMarker(lat, lng, message) {
    L.marker([lat, lng]).addTo(map).bindPopup(message).openPopup();
}

// Cargar ubicaciones existentes
async function loadLocations() {
    const { data } = await supabaseClient.from('locations').select('*');
    data.forEach(loc => addMarker(loc.lat, loc.lng, loc.message));
}
loadLocations();

// Escuchar nuevas ubicaciones
supabaseClient
    .channel('public:locations')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'locations' }, (payload) => {
        const { lat, lng, message } = payload.new;
        addMarker(lat, lng, message);
    })
    .subscribe();

// Botón para compartir ubicación
document.getElementById('shareLocation').addEventListener('click', async () => {
    if (navigator.geolocation) {
        console.log("Solicitando ubicación...");
        let locationObtained = false; // Bandera para evitar que el callback de error se ejecute incorrectamente
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                locationObtained = true; // Marcar que se obtuvo la ubicación
                console.log("Permiso de geolocalización otorgado.");
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                // Mostrar información detallada
                console.log("Coordenadas obtenidas:", lat, lng);
                console.log("Precisión (en metros):", position.coords.accuracy);
                console.log("Timestamp:", new Date(position.timestamp).toLocaleString());
                // Ajustar el mensaje sobre el método usado
                console.log("Método usado (aproximado):", position.coords.accuracy > 100 ? "Probablemente IP/Wi-Fi" : "Probablemente GPS");
                const message = prompt("¿Qué necesitas?");
                if (message) {
                    try {
                        const { data, error } = await supabaseClient.from('locations').insert([{ lat, lng, message }]);
                        if (error) {
                            document.getElementById('message').textContent = "Error al guardar: " + error.message;
                            console.error("Error de Supabase:", error.message, error.details, error.hint);
                        } else {
                            document.getElementById('message').textContent = "¡Ubicación compartida!";
                            map.setView([lat, lng], 15);
                            addMarker(lat, lng, message); // Añadir el marcador localmente
                        }
                    } catch (err) {
                        document.getElementById('message').textContent = "Error inesperado: " + err.message;
                        console.error("Error inesperado al insertar en Supabase:", err.message, err);
                    }
                }
            },
            (error) => {
                if (!locationObtained) { // Solo mostrar el error si no se obtuvo la ubicación
                    document.getElementById('message').textContent = "No pudimos encontrar tu ubicación: " + error.message;
                    console.error("Error de geolocalización:", error.message, error.code);
                }
            },
            {
                enableHighAccuracy: true, // Usar GPS si está disponible
                timeout: 5000, // 5 segundos de espera
                maximumAge: 0 // No usar caché
            }
        );
    } else {
        document.getElementById('message').textContent = "Tu navegador no soporta geolocalización.";
    }
});