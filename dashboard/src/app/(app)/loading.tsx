"use client";

import { motion } from "framer-motion";

export default function AppLoading() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
      aria-busy
      aria-label="Loading"
    >
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-3 w-20 rounded-full shimmer" />
          <div className="h-6 w-40 rounded-lg shimmer" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-28 rounded-lg shimmer" />
          <div className="h-8 w-20 rounded-lg shimmer" />
        </div>
      </div>

      {/* Metric grid skeleton */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.3 }}
            className="h-[90px] rounded-xl shimmer"
          />
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="h-[200px] rounded-xl shimmer" />

      {/* Two-col skeleton */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-[180px] rounded-xl shimmer" />
        <div className="h-[180px] rounded-xl shimmer" />
      </div>
    </motion.div>
  );
}
