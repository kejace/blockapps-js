var blockapps = require("blockapps-js");
var faucet = blockapps.routes.faucet;
var Solidity = blockapps.Solidity;
var Promise = require("bluebird");

blockapps.query.serverURI = "http://blockapps.cloudapp.net"
blockapps.polling.pollEveryMS = 1000
//blockapps.polling.pollTimeoutMS = 30000

var contract, keystore;
var names = {};
var privkey = "1dd885a423f4e212740f116afa66d40aafdbb3a381079150371801871d9ea281";

window.onload = start;

function start() {
    document.getElementById('placardArea').value = "No donations so far...";
    
    var donate = document.getElementById('donate');
    donate.disabled = true;    

    var randomSeed = ethlightjs.keystore.generateRandomSeed();
    keystore = new ethlightjs.keystore(randomSeed, "");

    Solidity(code).call("newContract", privkey).then(function(c) {
        contract = c;
        donate.disabled = false;
    }, function(e) {
        console.log("Error");
        console.log(e);
        donate.disabled = false;
    });
}

function buttonPush() {
    var name = document.getElementById('patronName').value; 
    var value = document.getElementById('patronValue').value;
    var placard = document.getElementById("placardArea");    
    var donate = document.getElementById('donate');

    donate.disabled = true;
    fund(name). 
        return(patronize(name, value)).
        then(function(reply) {
            console.log(reply);
            return artistPlacard().then(function(text){
                placard.value = text;
            });
        }, function(e) {
            console.log("Error");
            console.log(e);
        }).finally(function() {
            donate.disabled = false;
        }).catch(function() {});
}

function fund(name) {
    return faucet(patronKey(name).address);
}

function patronize(name, value) {
    return contract.state.patronize(name).txParams({"value":value}).
        callFrom(patronKey(name).privkey);
}

function patronKey(name) {
    if (name in names) {
        return names[name];
    }
    else {
        var address = keystore.generateNewAddress("");
        names[name] = {
            "privkey" : keystore.exportPrivateKey(address,""),
            "address" : address
        }
        return names[name];
    }
}

function artistPlacard() {
    return Promise.join(
        contract.state.artist,
        contract.state.numGrants,
        contract.state.patrons.map(contract.state.patronInfo),
        function(artist, numGrants, pInfos) {
            var lines = [
                "My name is: " + artist,
                "I have been generously supported by " + numGrants +
                    " grant(s) from the following patrons:",
            ]

            return lines.concat(pInfos.map(function(pInfo) {
                var result = "  The honorable " + pInfo.name;
                if (pInfo.returning) {
                    result += " (repeatedly)";
                }
                result += ": " + pInfo.totalPayments + " wei";
                return result;
            })).join("\n");
        }
    );
}

var code = "\
contract StarvingArtist {\n\
  address teacher;\n\
  uint numGrants;\n\
  string artist;\n\
\n\
  struct PatronInfo {\n\
    string name;\n\
    bool returning;\n\
    uint totalPayments;\n\
  }\n\
  mapping (address => PatronInfo) patronInfo;\n\
\n\
  address[] patrons;\n\
\n\
  function StarvingArtist() {\n\
    teacher = msg.sender;\n\
    artist = \"Paul Gaugin\";\n\
    patrons.length = 0;\n\
  }\n\
\n\
  function patronize(string name) returns (string) {\n\
    if (msg.value == 0) {\n\
      return \"Thanks for nothing!\";\n\
    }\n\
\n\
    var patron = patronInfo[msg.sender];\n\
    string memory message;\n\
    if (patron.totalPayments == 0) {\n\
      ++patrons.length;\n\
      patrons[patrons.length - 1] = msg.sender;\n\
\n\
      patron.name = name;\n\
      patron.returning = false;\n\
      message = \"Thanks for your patronage!\";\n\
    }\n\
    else if (patron.returning == false) {\n\
      patron.returning = true;\n\
      message = \"Thanks for returning!\";\n\
    }\n\
    else {\n\
       message = \"Hello again!\";\n\
    }\n\
    patron.totalPayments += msg.value;\n\
    patronInfo[msg.sender] = patron;\n\
    ++numGrants;\n\
    return message;\n\
  }\n\
\n\
}";
