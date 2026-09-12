// Point d'entrée de service pour kairo-scraper
console.log(JSON.stringify({ action: "notify", message: "Service KaïroOS Auto Scraper prêt" }));

process.stdin.on("data", (data) => {
  try {
    const msg = JSON.parse(data.toString().trim());
    if (msg.command === "start_batch") {
      console.log(JSON.stringify({ action: "notify", message: "Traitement par lot démarré" }));
    } else if (msg.command === "stop_batch") {
      console.log(JSON.stringify({ action: "notify", message: "Traitement par lot interrompu" }));
    } else if (msg.command === "status") {
      console.log(JSON.stringify({ action: "notify", message: "Statut Scraper : Opérationnel" }));
    }
  } catch (e) {}
});

// Garder le processus actif en tâche de fond
setInterval(() => {}, 60000);
