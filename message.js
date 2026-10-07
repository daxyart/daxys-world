const contactForm = document.getElementById("contactForm");

if (contactForm) {
    contactForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const name = `${document.getElementById("firstName").value.trim()} ${document.getElementById("lastName").value.trim()}`.trim();
        const email = document.getElementById("email").value.trim();
        const message = document.getElementById("message").value.trim();
        const subject = encodeURIComponent(`Message du site — ${name}`);
        const body = encodeURIComponent(`Nom : ${name}\nE-mail : ${email}\n\n${message}`);
        window.location.href = `mailto:yooungog@gmail.com?subject=${subject}&body=${body}`;
    });
}
