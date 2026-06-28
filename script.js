const SUPABASE_URL = "https://ysbqwlewtmuthvmazdqj.supabase.com";
const SUPABASE_KEY = "sb_publishable_9bF1ar95mgilBY4Y6QCnmQ_y04oeph-";
const EMAILJS_PUBLIC_KEY = "bL3T113OtDtDDrDCy";
const EMAILJS_SERVICE_ID = "service_4el2ws8";
const EMAILJS_TEMPLATE_ID = "template_xim0haq";

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

emailjs.init(EMAILJS_PUBLIC_KEY);

const servicios = {
  esmaltado: { nombre: "💅 Esmaltado", duracion: 2 },
  retiro: { nombre: "💅 Esmaltado + retiro", duracion: 2 },
  polygel: { nombre: "✨ Extensiones PolyGel", duracion: 3 }
};

const fecha = document.querySelector("#agenda-fecha");
const servicio = document.querySelector("#agenda-servicio");
const horasBox = document.querySelector("#agenda-horas");
const form = document.querySelector("#agenda-form");
const mensaje = document.querySelector("#agenda-mensaje");
let horaSeleccionada = "";

function hoyISO(){
  return new Date().toISOString().split("T")[0];
}

fecha.min = hoyISO();

function diaSemana(fechaISO){
  const [y,m,d] = fechaISO.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

async function obtenerReservas(fechaISO){
  const { data, error } = await db
    .from("Reservas")
    .select("*")
    .eq("fecha", fechaISO);

  if(error){
    console.error(error);
    return [];
  }

  return data || [];
}

function calcularHoras(fechaISO, reservas, servicioElegido){
  const dia = diaSemana(fechaISO);
  if(dia === 0) return [];

  let horas = dia === 6 ? ["10:00", "16:00"] : ["10:00", "15:00", "17:00"];

  const tomadas = reservas.map(r => r.hora);
  const hayPolyGel15 = reservas.some(r => r.servicio.includes("PolyGel") && r.hora === "15:00");

  if(hayPolyGel15 && !tomadas.includes("18:00")){
    horas.push("18:00");
  }

  if(servicioElegido === "polygel"){
    horas = horas.filter(h => {
      if(h === "18:00") return false;
      if(tomadas.includes(h)) return false;
      if(h === "15:00" && tomadas.includes("17:00")) return false;
      if(h === "16:00") return false;
      return true;
    });
  } else {
    horas = horas.filter(h => {
      if(tomadas.includes(h)) return false;
      if(hayPolyGel15 && h === "17:00") return false;
      return true;
    });
  }

  return horas;
}

async function cargarHoras(){
  horasBox.innerHTML = "";
  horaSeleccionada = "";
  mensaje.textContent = "";

  if(!fecha.value || !servicio.value){
    horasBox.innerHTML = "<p>🌸 Primero elige servicio y fecha.</p>";
    return;
  }

  const reservas = await obtenerReservas(fecha.value);
  const disponibles = calcularHoras(fecha.value, reservas, servicio.value);

  if(disponibles.length === 0){
    horasBox.innerHTML = "<p>😔 No hay horas disponibles para ese día.</p>";
    return;
  }

  disponibles.forEach(hora => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "hora-btn";
    btn.textContent = "🕒 " + hora;

    btn.onclick = () => {
      document.querySelectorAll(".hora-btn").forEach(b => b.classList.remove("activa"));
      btn.classList.add("activa");
      horaSeleccionada = hora;
    };

    horasBox.appendChild(btn);
  });
}

servicio.addEventListener("change", cargarHoras);
fecha.addEventListener("change", cargarHoras);

form.addEventListener("submit", async e => {
  e.preventDefault();

  const nombre = document.querySelector("#agenda-nombre").value.trim();
  const telefono = document.querySelector("#agenda-telefono").value.trim();
  const correo = document.querySelector("#agenda-correo").value.trim();

  if(!servicio.value || !fecha.value || !horaSeleccionada || !nombre || !telefono){
    mensaje.textContent = "⚠️ Completa todos los datos y selecciona una hora.";
    return;
  }

  const reservas = await obtenerReservas(fecha.value);
  const disponibles = calcularHoras(fecha.value, reservas, servicio.value);

  if(!disponibles.includes(horaSeleccionada)){
    mensaje.textContent = "😔 Esa hora acaba de ser tomada. Elige otra.";
    await cargarHoras();
    return;
  }

const { data, error } = await db.from("Reservas").insert({
    nombre,
    telefono,
    correo,
    servicio: servicios[servicio.value].nombre,
    fecha: fecha.value,
    hora: horaSeleccionada
  });

if(error){
  console.error("ERROR SUPABASE:", error);
  mensaje.textContent = "❌ Error: " + error.message;
  return;
}
await emailjs.send(
  EMAILJS_SERVICE_ID,
  EMAILJS_TEMPLATE_ID,
  {
    nombre: nombre,
    correo: correo,
    telefono: telefono,
    servicio: servicios[servicio.value].nombre,
    fecha: fecha.value,
    hora: horaSeleccionada
  }
);

form.reset();
await cargarHoras();

mensaje.textContent = "✅ Reserva agendada correctamente. Revisa tu correo de confirmación (recuerda revisar tu bandeja de spam), sino comunicate directamente a mi telefono 💅✨";
});
