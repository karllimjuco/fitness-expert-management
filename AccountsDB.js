
var SEED_ACCOUNTS = [
    {
        username: "karl01",
        password: "password123",
        staffName: "Karl Lopez"
    },
    {
        username: "marco",
        password: "password123",
        staffName: "Val Marco"
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
