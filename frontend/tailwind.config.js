/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        eocBg: "#0B1220",
        eocCard: "rgba(16, 24, 48, 0.55)",
        eocBorder: "rgba(255, 255, 255, 0.08)",
        astar: "#2ECC71",
        dijkstra: "#3498DB",
        emergency: "#E74C3C",
        hospital: "#1ABC9C",
        traffic: "#F39C12",
        mutedText: "#8F9CAE"
      },
      boxShadow: {
        neonGreen: "0 0 15px rgba(46, 204, 113, 0.4)",
        neonBlue: "0 0 15px rgba(52, 152, 219, 0.4)",
        neonRed: "0 0 20px rgba(231, 76, 60, 0.5)",
        glass: "0 8px 32px 0 rgba(0, 0, 0, 0.37)"
      }
    },
  },
  plugins: [],
}
