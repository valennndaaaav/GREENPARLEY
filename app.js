// CLAVES DE LAS DOS BASES DE DATOS SEPARADAS
const apiKeyPartidos = "0464d33c8013d01fb7387b5148f18a9a"; // BD 1: API-Sports (Partidos e Historial)
const apiKeyCuotas = "TU_NUEVA_API_KEY_AQUI"; // BD 2: The Odds API (Cuotas de 1xBet). Reemplazar por tu clave.

const hoy = new Date().toISOString().split('T')[0];
const urlPartidos = `https://v3.football.api-sports.io/fixtures?date=${hoy}`;
const optionsPartidos = { method: 'GET', headers: { 'x-apisports-key': apiKeyPartidos } };

let baseDeDatosHoy = []; 

function calcularPronostico(idLocal, idVisitante) {
    let factor = (idLocal + idVisitante) % 20; 
    let probSegura = 75 + factor, probModerada = 45 + factor, probArriesgada = 15 + factor; 

    const apuestasSeguras = ["Más de 1.5 Goles", "Doble Oportunidad (Local o Empate)", "Doble Oportunidad (Empate o Visita)", "Cualquiera gana"];
    const apuestasModeradas = ["Ambos Marcan (Sí)", "Gana Local", "Gana Visitante", "Más de 2.5 Goles"];
    const apuestasArriesgadas = ["Local y +2.5 Goles", "Empate Exacto", "Visita y Ambos Marcan", "Marcador (1-0 o 0-1)"];

    return { 
        segura: probSegura, jugadaSegura: apuestasSeguras[(idLocal) % apuestasSeguras.length],
        moderada: probModerada, jugadaModerada: apuestasModeradas[(idVisitante) % apuestasModeradas.length],
        arriesgada: probArriesgada, jugadaArriesgada: apuestasArriesgadas[(idLocal + idVisitante) % apuestasArriesgadas.length]
    };
}

// 1. CARGA DESDE LA BASE DE DATOS PRINCIPAL (API-SPORTS)
async function cargarPartidosDeHoy() {
    try {
        const respuesta = await fetch(urlPartidos, optionsPartidos);
        const datos = await respuesta.json();

        if (datos.errors && Object.keys(datos.errors).length > 0) {
            document.getElementById('contenedor-partidos').innerHTML = `<h3 style='color: #ffffff;'>[ERROR BD 1] LÍMITE DE CONSULTAS ALCANZADO.</h3>`;
            return; 
        }

        if (!datos.response || datos.response.length === 0) {
            document.getElementById('contenedor-partidos').innerHTML = "<h3 style='color: #aaaaaa;'>NO HAY REGISTROS HOY.</h3>";
            return;
        }

        baseDeDatosHoy = datos.response; 
        renderizarPartidos(baseDeDatosHoy.slice(0, 10));
    } catch (error) {
        document.getElementById('contenedor-partidos').innerHTML = "<h3 style='color: #ffffff;'>[ERROR BD 1] FALLA DE CONEXIÓN.</h3>";
    }
}

function renderizarPartidos(listaDePartidos) {
    const contenedor = document.getElementById('contenedor-partidos');
    contenedor.innerHTML = ''; 

    if (listaDePartidos.length === 0) return;

    const historialHTML = `<div class="historial"><span class="bg-g">G</span><span class="bg-e">E</span><span class="bg-g">G</span><span class="bg-p">P</span><span class="bg-g">G</span></div>`;

    listaDePartidos.forEach(partido => {
        const local = partido.teams.home, visitante = partido.teams.away, liga = partido.league;
        const horaLocal = new Date(partido.fixture.date).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
        const pre = calcularPronostico(local.id, visitante.id);

        const semaforoHTML = `
            <div class="semaforo" onclick="event.stopPropagation(); abrirModal('prediccion', ${partido.fixture.id}, ${local.id}, ${visitante.id}, '${local.name.replace(/'/g, "\\'")}', '${visitante.name.replace(/'/g, "\\'")}', '${pre.jugadaSegura}', '${pre.jugadaModerada}', '${pre.jugadaArriesgada}', ${pre.segura}, ${pre.moderada}, ${pre.arriesgada})">
                <div class="luz luz-blanca">${pre.segura}%</div>
                <div class="luz luz-gris">${pre.moderada}%</div>
                <div class="luz luz-oscura">${pre.arriesgada}%</div>
            </div>`;

        contenedor.innerHTML += `
            <div class="tarjeta-partido" onclick="abrirModal('estadisticas', ${partido.fixture.id}, ${local.id}, ${visitante.id}, '${local.name.replace(/'/g, "\\'")}', '${visitante.name.replace(/'/g, "\\'")}')">
                <div class="encabezado-liga"><img src="${liga.logo}"><span>${liga.name}</span></div>
                <div class="cuerpo-partido">
                    <div class="info-partido">
                        <div class="equipo"><img src="${local.logo}"><span>${local.name}</span>${historialHTML}</div>
                        <div class="centro-partido"><div class="hora">${horaLocal}</div></div>
                        <div class="equipo"><img src="${visitante.logo}"><span>${visitante.name}</span>${historialHTML}</div>
                    </div>
                    ${semaforoHTML}
                </div>
            </div>`;
    });
}

// 2. FUSIÓN: CONSULTA A LA SEGUNDA BASE DE DATOS AL ABRIR EL MODAL
async function abrirModal(tipo, idFixture, idLocal, idVisitante, nombreLocal, nombreVisitante, betSegura, betModerada, betArriesgada, pSegura, pModerada, pArriesgada) {
    const modal = document.getElementById('mi-modal'), titulo = document.getElementById('modal-titulo'), cuerpo = document.getElementById('modal-cuerpo');
    modal.classList.remove('oculto'); 

    if (tipo === 'prediccion') {
        titulo.innerText = 'JUGADAS SUGERIDAS';
        cuerpo.innerHTML = `<h4 style="text-align:center; color: #aaaaaa;">CONECTANDO CON BD 2 (1XBET)...</h4>`;

        // Valores por defecto (Algoritmo)
        let cSegura = (100 / pSegura).toFixed(2), cModerada = (100 / pModerada).toFixed(2), cArriesgada = (100 / pArriesgada).toFixed(2);

        // Intento de extraer datos reales de la SEGUNDA BD (The Odds API)
        if (apiKeyCuotas !== "TU_NUEVA_API_KEY_AQUI") {
            try {
                // Buscamos cuotas de fútbol para 1xBet
                const urlOtraBD = `https://api.the-odds-api.com/v4/sports/upcoming/odds/?regions=eu&markets=h2h&bookmakers=1xbet&apiKey=${apiKeyCuotas}`;
                const resOtraBD = await fetch(urlOtraBD);
                const datosOtraBD = await resOtraBD.json();

                // Lógica de Sincronización: Buscar coincidencia de nombres entre la BD 1 y la BD 2
                const partidoFondo = datosOtraBD.find(p => 
                    p.home_team.toLowerCase().includes(nombreLocal.toLowerCase().substring(0, 5)) || 
                    nombreLocal.toLowerCase().includes(p.home_team.toLowerCase().substring(0, 5))
                );

                if (partidoFondo && partidoFondo.bookmakers.length > 0) {
                    const apuestas = partidoFondo.bookmakers[0].markets[0].outcomes;
                    
                    const asginarCuotaReal = (jugada) => {
                        if(jugada === "Gana Local") return apuestas.find(a => a.name === partidoFondo.home_team)?.price;
                        if(jugada === "Gana Visitante") return apuestas.find(a => a.name === partidoFondo.away_team)?.price;
                        if(jugada === "Empate Exacto") return apuestas.find(a => a.name === 'Draw')?.price;
                        return null;
                    };

                    let rSegura = asginarCuotaReal(betSegura); if(rSegura) cSegura = rSegura;
                    let rModerada = asginarCuotaReal(betModerada); if(rModerada) cModerada = rModerada;
                    let rArriesgada = asginarCuotaReal(betArriesgada); if(rArriesgada) cArriesgada = rArriesgada;
                }
            } catch (error) {
                console.error("Fallo de sincronización con la BD 2. Usando algoritmo.");
            }
        }

        cuerpo.innerHTML = `
            <p style="color: #aaaaaa;">CUOTAS ESTIMADAS O SINCRONIZADAS:</p>
            <ul style="list-style: none; padding: 0;">
                <li style="border: 1px solid #ffffff; padding: 10px; margin-bottom: 8px; border-radius: 5px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div><strong style="color: #ffffff;">SEGURA (${pSegura}%):</strong><br> ${betSegura}</div>
                        <span style="background-color: #ffffff; color: #000000; padding: 5px 10px; border-radius: 6px; font-weight: bold;">${cSegura}</span>
                    </div>
                </li>
                <li style="border: 1px solid #aaaaaa; padding: 10px; margin-bottom: 8px; border-radius: 5px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div><strong style="color: #aaaaaa;">MODERADA (${pModerada}%):</strong><br> ${betModerada}</div>
                        <span style="background-color: #aaaaaa; color: #000000; padding: 5px 10px; border-radius: 6px; font-weight: bold;">${cModerada}</span>
                    </div>
                </li>
                <li style="border: 1px solid #555555; padding: 10px; margin-bottom: 8px; border-radius: 5px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div><strong style="color: #555555;">ARRIESGADA (${pArriesgada}%):</strong><br> ${betArriesgada}</div>
                        <span style="background-color: #555555; color: #ffffff; padding: 5px 10px; border-radius: 6px; font-weight: bold;">${cArriesgada}</span>
                    </div>
                </li>
            </ul>`;
    } 
    else if (tipo === 'estadisticas') {
        titulo.innerText = `H2H HISTORIAL`;
        cuerpo.innerHTML = `<h4 style="text-align:center; color: #aaaaaa;">CONECTANDO CON BD 1...</h4>`;
        try {
            const urlH2H = `https://v3.football.api-sports.io/fixtures/headtohead?h2h=${idLocal}-${idVisitante}`;
            const respuestaH2H = await fetch(urlH2H, optionsPartidos);
            const datosH2H = await respuestaH2H.json();
            
            if (datosH2H.errors && Object.keys(datosH2H.errors).length > 0) { cuerpo.innerHTML = `<p style="color: #ffffff;">[ERROR] LÍMITE DE CONSULTAS BD 1.</p>`; return; }
            
            const partidosAnteriores = datosH2H.response.slice(0, 3);
            if (partidosAnteriores.length === 0) {
                cuerpo.innerHTML = `<p>SIN REGISTROS RECIENTES.</p>`;
            } else {
                let listaHTML = '<ul style="list-style: none; padding: 0;">';
                partidosAnteriores.forEach(p => {
                    const fecha = new Date(p.fixture.date).toLocaleDateString('es-AR');
                    const golesLocal = p.goals.home !== null ? p.goals.home : '-';
                    const golesVisita = p.goals.away !== null ? p.goals.away : '-';
                    listaHTML += `<li style="background: #1a1a1a; margin-bottom: 8px; padding: 10px; border-radius: 6px; border: 1px solid #333;"><span style="color:#888888; font-size: 0.8rem;">[${fecha}]</span><br><strong>${p.teams.home.name} <span style="color: #ffffff;">${golesLocal} - ${golesVisita}</span> ${p.teams.away.name}</strong></li>`;
                });
                cuerpo.innerHTML = listaHTML + '</ul>';
            }
        } catch (error) { cuerpo.innerHTML = `<p style="color: #ffffff;">[ERROR BD 1] FALLA DE CONEXIÓN.</p>`; }
    }
}

function cerrarModal() { document.getElementById('mi-modal').classList.add('oculto'); }
document.getElementById('mi-modal').addEventListener('click', function(e) { if (e.target === this) cerrarModal(); });

const menuBoton = document.getElementById('menu-boton'), menuOpciones = document.getElementById('menu-opciones'), menuTexto = document.getElementById('menu-texto'), opciones = document.querySelectorAll('.opcion');
menuBoton.addEventListener('click', () => menuOpciones.classList.toggle('oculto'));
opciones.forEach(opcion => {
    opcion.addEventListener('click', () => {
        const idLiga = opcion.getAttribute('data-value');
        menuTexto.innerHTML = opcion.innerHTML;
        menuOpciones.classList.add('oculto'); 
        renderizarPartidos(idLiga === "todos" ? baseDeDatosHoy.slice(0, 10) : baseDeDatosHoy.filter(p => p.league.id == idLiga));
    });
});
document.addEventListener('click', (e) => { if (!menuBoton.contains(e.target) && !menuOpciones.contains(e.target)) menuOpciones.classList.add('oculto'); });

cargarPartidosDeHoy();
