import { useTheme } from "@/components/theme/use-theme";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_layout/settings")({
  component: SettingsComponent,
});

function SettingsComponent() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
          Settings
        </h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Manage your workspace preferences and configuration
        </p>
      </div>

      {/* Settings Sections */}
      <div className="space-y-6">
        {/* General Settings */}
        <div className="bg-white dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800">
          <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
            <h2 className="text-base font-medium text-neutral-900 dark:text-neutral-100">
              General
            </h2>
          </div>
          <div className="p-6 space-y-6">
            <div>
              <label
                htmlFor="workspace-name"
                className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2"
              >
                Workspace Name
              </label>
              <input
                type="text"
                id="workspace-name"
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
                defaultValue="My Workspace"
              />
            </div>

            <div>
              <label
                htmlFor="timezone"
                className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2"
              >
                Timezone
              </label>
              <select
                id="timezone"
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
              >
                <option>UTC</option>
                <option>Eastern Time (ET)</option>
                <option>Pacific Time (PT)</option>
                <option>Central European Time (CET)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Appearance */}
        <div className="bg-white dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800">
          <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
            <h2 className="text-base font-medium text-neutral-900 dark:text-neutral-100">
              Appearance
            </h2>
          </div>
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">
                Theme
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => setTheme("light")}
                  className={`p-3 border-2 ${theme === "light" ? "border-blue-500 bg-neutral-50 dark:bg-neutral-800" : "border-neutral-200 dark:border-neutral-700"} rounded-lg text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors`}
                >
                  Light
                </button>
                <button
                  onClick={() => setTheme("dark")}
                  className={`p-3 border-2 ${theme === "dark" ? "border-blue-500 bg-neutral-50 dark:bg-neutral-800" : "border-neutral-200 dark:border-neutral-700"} rounded-lg text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors`}
                >
                  Dark
                </button>
                <button
                  onClick={() => setTheme("system")}
                  className={`p-3 border-2 ${theme === "system" ? "border-blue-500 bg-neutral-50 dark:bg-neutral-800" : "border-neutral-200 dark:border-neutral-700"} rounded-lg text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors`}
                >
                  System
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Accent Color
              </label>
              <div className="flex space-x-2">
                <button className="w-8 h-8 bg-blue-500 rounded-full border-2 border-neutral-300 dark:border-neutral-600"></button>
                <button className="w-8 h-8 bg-purple-500 rounded-full border-2 border-transparent hover:border-neutral-300 dark:hover:border-neutral-600"></button>
                <button className="w-8 h-8 bg-green-500 rounded-full border-2 border-transparent hover:border-neutral-300 dark:hover:border-neutral-600"></button>
                <button className="w-8 h-8 bg-orange-500 rounded-full border-2 border-transparent hover:border-neutral-300 dark:hover:border-neutral-600"></button>
                <button className="w-8 h-8 bg-pink-500 rounded-full border-2 border-transparent hover:border-neutral-300 dark:hover:border-neutral-600"></button>
              </div>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white dark:bg-neutral-950 rounded-lg border border-neutral-200 dark:border-neutral-800">
          <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
            <h2 className="text-base font-medium text-neutral-900 dark:text-neutral-100">
              Notifications
            </h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  Email Notifications
                </p>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  Receive updates about your workspace via email
                </p>
              </div>
              <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-blue-600 dark:bg-blue-500">
                <span className="translate-x-6 inline-block h-4 w-4 transform rounded-full bg-white transition"></span>
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  Desktop Notifications
                </p>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  Get notified about important updates on desktop
                </p>
              </div>
              <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-neutral-200 dark:bg-neutral-700">
                <span className="translate-x-1 inline-block h-4 w-4 transform rounded-full bg-white dark:bg-neutral-200 transition"></span>
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  Weekly Digest
                </p>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  Summary of your workspace activity
                </p>
              </div>
              <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-blue-600 dark:bg-blue-500">
                <span className="translate-x-6 inline-block h-4 w-4 transform rounded-full bg-white transition"></span>
              </button>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4">
          <button className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-neutral-900">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
