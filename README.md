# 🚀 Template Node Express

<div align="center">

**A modern, production-ready Node.js backend template built with best practices, TypeScript, and a scalable architecture.**

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-336791?style=for-the-badge&logo=postgresql&logoColor=white)

</div>

---

## ✨ Features

- ⚡ **Node.js + Express**
- 🔷 **TypeScript** with strict typing
- 🗄️ **Prisma ORM**
- 🐘 **PostgreSQL**
- ✅ **Zod** request validation
- 🔐 **JWT Authentication**
- 🔒 **Password Hashing** with bcrypt
- 📋 **Pino** structured logging
- 🧪 **Vitest** testing setup
- 🎨 **ESLint + Prettier**
- 🪝 **Husky** Git hooks
- 📦 Clean and scalable folder structure
- 🚀 Ready for production deployment

---

# 🛠 Tech Stack

| Technology | Purpose |
|------------|---------|
| **Node.js** | Runtime |
| **Express** | Web Framework |
| **TypeScript** | Programming Language |
| **Prisma** | ORM |
| **PostgreSQL** | Database |
| **Zod** | Validation |
| **JWT** | Authentication |
| **bcrypt** | Password Hashing |
| **Pino** | Logging |
| **Vitest** | Testing |
| **ESLint** | Linting |
| **Prettier** | Code Formatting |
| **Husky** | Git Hooks |

---

# 📂 Project Structure

```text
src/
├── config/          # Environment & database configuration
├── constants/       # HTTP status codes and application constants
├── controllers/     # Request handlers
├── middlewares/     # Express middlewares
├── routes/          # API routes
├── schemas/         # Zod validation schemas
├── services/        # Business logic
├── types/           # TypeScript types
└── utils/           # Helper utilities
```

---

# 🚀 Getting Started

## 1. Clone the Repository

```bash
gh repo clone aduch123/template-node-express your-project-name
```

```bash
cd your-project-name
```

---

## 2. Install Dependencies

```bash
npm install
```

---

## 3. Configure Environment Variables

Copy the example environment file.

```bash
cp .env.example .env
```

Update the values inside `.env` according to your environment.

---

## 4. Start PostgreSQL

```bash
docker compose up -d
```

---

## 5. Generate Prisma Client

```bash
npm run prisma:generate
```

---

## 6. Run Database Migrations

```bash
npm run prisma:migrate
```

---

## 7. Start the Development Server

```bash
npm run dev
```

The server should now be running successfully.

---

# 📜 Available Scripts

| Command | Description |
|----------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Compile TypeScript |
| `npm run start` | Run compiled application |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code using Prettier |
| `npm run test` | Run tests |
| `npm run prisma:generate` | Generate Prisma Client |
| `npm run prisma:migrate` | Apply database migrations |

---

# 🌱 Environment Variables

Create a `.env` file using the provided example.

```bash
cp .env.example .env
```

See **`.env.example`** for all required configuration values.

---

# 📦 Production Build

Build the application:

```bash
npm run build
```

Run the compiled application:

```bash
npm run start
```

---

# 🧪 Testing

Run all tests:

```bash
npm run test
```

---

# 🎨 Code Quality

Lint the project:

```bash
npm run lint
```

Format the project:

```bash
npm run format
```

---

# 🗄 Database

Generate Prisma Client:

```bash
npm run prisma:generate
```

Run migrations:

```bash
npm run prisma:migrate
```

---

# 🤝 Contributing

Contributions, issues, and feature requests are welcome!

1. Fork the repository
2. Create a new branch
3. Commit your changes
4. Open a Pull Request

---

# 📄 License

This project is licensed under the **MIT License**.

---

<div align="center">

### ⭐ If this template helps you, consider giving it a star!

**Happy Coding! 🚀**

</div>