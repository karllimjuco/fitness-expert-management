// A browser cannot read a .txt file directly when opened via file:// protocol due to security restrictions.
// Using a JavaScript file allows the seed accounts to load cleanly in local browser environments without a server.

var SEED_ACCOUNTS = [
    {
        username: "karl01",
        password: "password123",
        staffName: "Karl Lopez"
    },
    {
        username: "maria02",
        password: "password123",
        staffName: "Maria Santos"
    },
    {
        username: "totle03",
        password: "password123",
        staffName: "Totle Admin"
    }
];

// Returns combined list of default seed accounts and registered accounts from localStorage
function getAllAccounts() {
    var stored = localStorage.getItem("gym_accounts");
    var localAccounts = [];
    if (stored) {
        try {
            localAccounts = JSON.parse(stored);
        } catch (e) {
            localAccounts = [];
        }
    }
    return SEED_ACCOUNTS.concat(localAccounts);
}
