// Gestion des messages
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const messages = document.getElementById('messages');

sendButton.addEventListener('click', () => {
    const message = messageInput.value.trim();
    if (message) {
        const newMessage = document.createElement('li');
        newMessage.textContent = message;
        messages.appendChild(newMessage);
        messageInput.value = '';
    }
});
// Gestion des catégories
const categoryButtons = document.querySelectorAll('.category-button');

categoryButtons.forEach(button => {
    button.addEventListener('click', () => {
        // Supprime la classe sélectionnée de tous les boutons
        categoryButtons.forEach(btn => btn.classList.remove('selected-category'));

        // Ajoute la classe sélectionnée au bouton cliqué
        button.classList.add('selected-category');

        alert(`Vous avez sélectionné la catégorie : ${button.dataset.category}`);
    });
});