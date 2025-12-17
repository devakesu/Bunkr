# GhostClass

## Overview

GhostClass is the ultimate academic survival tool for students who want to manage their attendance without the main character energy of a professor. Featuring a sleek dashboard with real-time analytics and visual performance charts, it helps you track your classes so you never accidentally ghost your degree. With a built-in "bunk calculator" to tell you exactly how many lectures you can skip before it becomes a canon event, and a dedicated tracker for suspicious absences, GhostClass ensures your attendance stays valid while you live your best life. Built as a better alternative to Ezygo, it presents your attendance data with a clean, intuitive interface. No more confusing numbers - just clear, actionable insights!

<br />

## 🎯 Key "Vibe" Features
- **The Bunk Calc** 🧮: Know exactly how many classes you can miss before the threshold comes for your neck.
- **Visual Reciepts** 📊: Performance charts and a detailed calendar history so you can see your attendance glow-up in real-time.
- **Anti-Ghosting Tracker** 👻: A personalized list to watch wrongly marked absences like a hawk until they get updated.
- **Ezygo Integration** 🔄 - Use your existing ezygo credentials - no new accounts needed
- **Real-time Updates** ⚡ - Get instant updates on your attendance status and skip calculations
- **Track Status Changes** 📝 – Get notified when your attendance is updated
- **Mobile Friendly** 📱 - Access your attendance data on any device, anywhere

<br />

## 🛠️ Tech Stack

- **Frontend** - Next.js with React
- **Styling** - Tailwind CSS for a modern, responsive design
- **UI Components** - Radix UI for accessible, consistent components
- **Data Visualization** - Recharts for beautiful attendance graphs
- **Animations** - Framer Motion for smooth transitions
- **Additional Services** – Supabase

<br />

## 📁 Project Structure

```
src/
├── app/              # Next.js app router pages and layouts
│   ├── (auth)/      # Authentication-related routes
│   ├── (root)/      # Main application routes
│   ├── globals.css  # Global styles
│   └── layout.tsx   # Root layout
├── components/       # Reusable React components
├── providers/        # React context providers
├── utils/           # Utility functions
├── assets/          # Static assets
├── types/           # TypeScript type definitions
├── lib/             # Core library code
└── hooks/           # Custom React hooks
```

<br />

## 🔌 API Integration

Create a `.env` file in the root directory and add:
```
NEXT_PUBLIC_BACKEND_URL=
NEXT_PUBLIC_SUPABASE_API_URL=
NEXT_PUBLIC_GITHUB_URL=
```

<br />

## 🧮 Bunk Algorithm

```ts
1. If total <= 0 or present <= 0 → return zero

2. current% = (present / total) * 100

3. If current% == target → isExact = true

4. If current% < target:
   required = ceil((target * total - 100 * present) / (100 - target))

5. If current% > target:
   bunkable = floor((100 * present - target * total) / target)
```

*Original implementation available here: [bunk.ts](https://github.com/ABHAY-100/bunkr-web/blob/main/src/utils/bunk.ts)*

<br />

## 🚀 Getting Started

### Prerequisites

- Node.js (Latest LTS version recommended)
- npm or yarn

### Quick Start

1. Clone the Repository
   ```bash
   git clone [https://github.com/ABHAY-100/bunkr-web.git](https://github.com/devakesu/GhostClass.git)
   ```

2. Navigate to Project Directory
   ```bash
   cd GhostClass
   ```

3. Install Dependencies
   ```bash
   npm install
   # or
   yarn install
   ```

4. Create `.env` file and add the API URL

5. Start Development Server
   ```bash
   npm run dev
   # or
   yarn dev
   ```

The application will be available at `http://localhost:3000` 🎉

<br />

## 🤝 Contributing

We welcome contributions! Here's how you can help:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

<br />

## 👥 This build maintained by
- [Devanarayanan](https://github.com/devakesu/)
  
Earlier version developed by:
- [Abhay Balakrishnan](https://github.com/ABHAY-100)
- [Asil Mehaboob](https://github.com/AsilMehaboob)
- [Sreyas B Anand](https://github.com/sreyas-b-anand)

<br />

## 📧 Contact

For any questions, feel free to reach out to me via email at [fusion@devakesu.com](mailto:fusion@devakesu.com)

<br />

## 📄 License

This project is licensed under the **GNU General Public License v3.0** - see the [LICENSE](LICENSE) file for details.

<br />

***Thank you for your interest in GhostClass! Bunk classes & enjoy, but don't forgot to study!! 😝🤝***
