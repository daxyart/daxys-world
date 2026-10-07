// Shared by the home page and the full gallery page.
document.querySelectorAll(".gallery img, .partner img").forEach((image) => {
    image.addEventListener("mouseenter", () => {
        image.style.transform = "scale(1.05)";
        image.style.transition = "transform 0.2s ease";
    });
    image.addEventListener("mouseleave", () => {
        image.style.transform = "scale(1)";
    });
});

document.querySelectorAll(".navbar a[href^='#']").forEach((link) => {
    link.addEventListener("click", (event) => {
        const target = document.querySelector(link.getAttribute("href"));
        if (target) {
            event.preventDefault();
            target.scrollIntoView({ behavior: "smooth" });
        }
    });
});

const themeButton = document.getElementById("toggleThemeButton");
if (themeButton) {
    themeButton.addEventListener("click", () => {
        document.body.classList.toggle("dark-theme");
    });
}

const introText = document.getElementById("introText");
if (introText) {
    window.setTimeout(() => {
        introText.textContent = "Préparez-vous à vivre une aventure inoubliable !";
    }, 3000);
}

const events = document.querySelector("#events ul");
if (events) {
    events.addEventListener("click", (event) => {
        if (event.target instanceof HTMLElement) {
            const selectedEvent = event.target.closest("li");
            if (selectedEvent) {
                alert(`Événement sélectionné : ${selectedEvent.textContent.trim()}`);
            }
        }
    });
}
