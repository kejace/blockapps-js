module.exports = {
    queryAPI : queryAPI,
    postAPI : postAPI,
    apiPrefix : "" //"/eth/v1.0"
}

function queryAPI (queryURL, callback) {
    var oReq = new XMLHttpRequest();
    oReq.open("GET", queryURL, true);
    oReq.onload = function () { 
        if(oReq.readyState == 4 && oReq.status == 200) {
            if (typeof callback === "function") {
	        var response = JSON.parse(this.responseText)
                callback(response);
            }
	}
        else {
            console.log(this.responseText);
        }
    }

    oReq.send();
}

function postAPI(postURL, data, contentType, callback) {
    var oReq = new XMLHttpRequest();
    oReq.open("POST", postURL, true);

    if (contentType !== undefined) {
        oReq.setRequestHeader("Content-type", contentType);
    }

    oReq.onload = function () { 
        if(oReq.readyState == 4 && oReq.status == 200) {
            if (typeof callback === "function") {
                callback(this.responseText);
            }
        }
        else {
            console.log(this.responseText);            
        }
    }

    oReq.send(data);
}