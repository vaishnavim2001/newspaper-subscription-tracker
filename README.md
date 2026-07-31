# Apartment Newspaper Subscription Tracker

A full-stack web application for managing newspaper and magazine subscriptions across households in an apartment complex. The application allows apartment managers to manage subscriptions across all units, while residents can securely view their own active subscriptions and monthly bills.

This project is being developed as a portfolio project to demonstrate modern full-stack web development practices using React, Node.js, Express, PostgreSQL, JWT authentication, and Redis.

---

## Features

### Admin

* Manage apartments
* Add, edit, and remove publications
* Create and manage apartment subscriptions
* View subscriptions for any apartment
* Cancel subscriptions
* View monthly bill totals for each apartment

### Resident

* Secure login
* View active subscriptions
* View monthly bill
* Track subscribed newspapers and magazines

---

## Tech Stack

### Frontend

* React
* Vite
* React Router
* Axios

### Backend

* Node.js
* Express.js
* REST API

### Database

* PostgreSQL

### Authentication

* JWT (Access Token)
* Refresh Token *(planned)*

### Caching

* Redis *(planned)*

### Deployment

* Frontend: Vercel
* Backend: Render
* Database: PostgreSQL

---

## Project Structure

```text
apartment-subscription-tracker/
│
├── frontend/
│   └── React + Vite application
│
├── backend/
│   └── Express REST API
│
├── database/
│   └── schema.sql
│
├── README.md
└── .gitignore
```

---

## Database Schema

The project consists of four primary tables:

* **apartments**

  * Apartment details

* **users**

  * Resident and administrator accounts

* **publications**

  * Newspapers and magazines

* **subscriptions**

  * Maps apartments to subscribed publications

---

## Planned Features

* JWT Authentication
* Role-based Authorization
* Apartment-wise Subscription Management
* Monthly Bill Calculation
* Subscription Cancellation
* Redis Caching
* Refresh Token Authentication
* CI/CD using GitHub Actions
* Email Notifications
* Billing History
* Live Deployment

---

## REST API (Planned)

| Method | Endpoint                            | Description                        |
| ------ | ----------------------------------- | ---------------------------------- |
| POST   | `/api/auth/login`                   | User login                         |
| GET    | `/api/apartments`                   | Get all apartments                 |
| GET    | `/api/apartments/:id/subscriptions` | Get subscriptions for an apartment |
| POST   | `/api/subscriptions`                | Create a subscription              |
| DELETE | `/api/subscriptions/:id`            | Cancel a subscription              |
| GET    | `/api/apartments/:id/bill`          | Get monthly bill                   |

---

## Getting Started

### Clone the repository

```bash
git clone https://github.com/<your-username>/apartment-subscription-tracker.git
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

```bash
cd backend
npm install
npm run dev
```

---

## Future Improvements

* Redis-based caching
* Refresh token authentication
* Email notifications
* Billing history and reports
* Docker support
* Automated testing
* GitHub Actions CI/CD
* Improved UI/UX

---

## Learning Objectives

This project is intended to demonstrate practical experience with:

* React and component-based architecture
* RESTful API design
* Express.js backend development
* PostgreSQL database design
* Authentication and authorization
* Redis caching
* Full-stack application architecture
* Deployment of modern web applications

---

## License

This project is intended for educational and portfolio purposes.
