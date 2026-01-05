# Chat WebSocket Project

Ce projet est une application de chat en temps réel construite avec **NestJS** (Backend) et **React + Vite** (Frontend), utilisant **Socket.io** pour la communication temps réel et **Prisma** avec **SQLite** pour la base de données.

## Prérequis

*   Node.js (v18+ recommandé)
*   npm

---

## Installation et Démarrage

### Option 1 : Avec Docker (Recommandé)

1. Assurez-vous d'avoir **Docker** et **Docker Compose** installés.
2. À la racine du projet, lancez la commande :
   ```bash
   docker-compose up --build
   ```
3. Accédez à l'application :
   - **Frontend** : `http://localhost`
   - **Backend** : `http://localhost:3002`

### Option 2 : Installation Manuelle (Développement)

#### 1. Backend (API & WebSocket)

Le backend tourne sur le port **3002**.

1.  Accédez au dossier `backend` :
    ```bash
    cd backend
    ```

2.  Installez les dépendances :
    ```bash
    npm install
    ```

3.  Configurez les variables d'environnement :
    Créez un fichier `.env` à la racine du dossier `backend` avec le contenu suivant :
    ```env
    DATABASE_URL="file:./dev.db"
    JWT_SECRET="supersecret"
    PORT=3002
    ```

4.  Initialisez la base de données (SQLite) :
    ```bash
    npx prisma migrate dev
    ```

5.  Lancez le serveur en mode développement :
    ```bash
    npm run start:dev
    ```

Le backend sera accessible à l'adresse : `http://localhost:3002`.

### 2. Frontend (React UI)

1.  Ouvrez un **nouveau terminal** et accédez au dossier `frontend` :
    ```bash
    cd frontend
    ```

2.  Installez les dépendances :
    ```bash
    npm install
    ```

3.  Lancez l'application :
    ```bash
    npm run dev
    ```

4.  Ouvrez votre navigateur sur l'URL indiquée (généralement `http://localhost:5173`).

---

## Fonctionnalités

*   **Authentification** : Inscription et connexion (JWT).
*   **Chat temps réel** : Envoi et réception de messages instantanés.
*   **Salons (Rooms)** :
    *   Création de salons publics ou privés.
    *   Invitation d'utilisateurs dans les salons privés.
    *   Historique des messages (activable/désactivable par salon).
*   **Profil** : Modification du nom d'utilisateur et de la couleur d'affichage.
*   **Réactions** : Ajout de réactions (emojis) aux messages.
*   **Indicateurs de frappe** : "X est en train d'écrire...".

## Commandes utiles

*   **Backend** :
    *   `npx prisma studio` : Interface graphique pour visualiser la base de données.
    *   `npx prisma migrate reset` : Réinitialiser la base de données (attention, efface tout).