# React-redux-simple-jwt (R2SJ)
A DEAD Simple redux middleware for JWT auth based react applications.

**Additional Packages required**:
- axios: 0.18.0 (or above)
- Redux-thunk: 2.3.0 (or above)
###### Note: Redux-thunk must be included in the middleware chain ([see Installation](#Installation))

# Why do I need It?
React-redux-simple-jwt (R2SJ for short) allows you to use JWT tokens in react-redux app by attaching access token to Authorization Header of the request being sent to API server.

# Installation
 ##### Npm:

```sh
$ npm install react-redux-simple-jwt
```
Then, add R2SJ to middleware chain:
```js
import { createStore, applyMiddleware } from 'redux';
import { CreateJwtMiddleware } from 'react-redux-simple-jwt';
import rootReducer from './reducers/index';
import thunk from 'redux-thunk';
import { JWTConfig } from './jwtConfig';
// Note: this API requires redux@>=3.1.0

// Refer to the Configuration section for creating JWTConfig
const jwtMiddleware = CreateJwtMiddleware(JWTConfig);

const store = createStore(
  rootReducer,
  applyMiddleware(
    jwtMiddleware,  // This must be added before thunk
    thunk // thunk is necessary for jwtMiddleware to work
  )
);
```
# Configuration
CreateJwtMiddleware requires a configuration object to generate R2SJ middleware:
Example:
```js
....

const JWTConfig = {
    refreshEndpoint: 'www.example.com/auth/refresh', // endpoint for access token refresh
    accessTokenExpireTime: 0.00347222, // 5 minutes expressed in days
} 

// insert this middleware in applymiddleware chain (before thunk)
const jwtMiddleware = CreateJwtMiddleware(JWTConfig);

...
```
##### Configuration options:

* **`refreshEndpoint`** - (**Required**) specify the server endpoint for refreshing access token.  
* **`accessTokenExpireTime`** - (**Required**) duration (in days) for access token to live. (*access token will be deleted from the client browser after this duration*)

# How to use
Generally async actions such as fetching/posting resources from server is done using action creator which returns a function containing the request ( these requests are created using APIs like fetch or axios ). These functions are then called by redux-thunk.
The main problem is to include access token in this request's header. This is because it needs some extra code to ensure that the access token is regularly refreshed and attached to request's header.

In order to use R2SJ, action creator must return a ***request-object***. This object includes all the necessary details required by R2SJ middleware to create the request. The best thing about this is that refreshing and attaching access token to request header is now managed by R2SJ itself.
Request is made  and the response is dispatched to reducers.
**(R2SJ can also pass the server response to a function instead. [See Here](#Passing_response_to_function_instead_of_reducers) )**
##### Example Scenerio
* *Without R2SJ (Using redux thunk)*
```js
import axios from 'axios';
import { 
    SENDING_DATA,
    SENDING_DATA_SUCCESSFUL,
    SENDING_DATA_FAILED
} from './action_types'

// some user defined function to fetch access token
let accessToken = getAccessToken(); 

// action creator posting data to the API server
function postData(data){
    let request = axios.post(
                'example.com/api/send/data/here',
                data,
                {headers: {Authorization : `Bearer ${accessToken}`}}
            )
    return (dispatch) => {
        dispatch({type: SENDING_DATA})
        return request.then(({data}) => dispatch({type: SENDING_DATA_SUCCESSFUL, payload: data}))
                .catch(error => dispatch({type: SENDING_DATA_FAILED}))
    }
}
```

* With R2SJ middleware
```js
import { 
    SENDING_DATA,
    SENDING_DATA_SUCCESSFUL,
    SENDING_DATA_FAILED
} from './action_types';

// action creator posting data to the API server
function postData(data){
    // request-object to be used by R2SJ middleware
    let requestObject = {
        loadingType: SENDING_DATA,
        successType: SENDING_DATA_SUCCESSFUL,
        failedType: SENDING_DATA_FAILED,
        request: {
            url: "example.com/api/send/data/here",
            method: "post",
            data: data
        }
    };
    return requestObject;
}
```
##### request-object keys:

* **`loadingType`** : (**Optional**) Type to dispatch while the request is being resolved  
* **`successType`** : (**Required**) Type to dispatch when request has successfully resolved. (Response data is associated with payload key of dispatched action)
* **`failedType`** : (**Required**) Type to dispatch on error response from server. (Error response is associated with payload key of dispatched action)
* **`request`** : (**Required**) Object used by R2SJ to create the request. Keys in this object:
    * **`url`** : (**Required**)Specifiy the URL for request
    * **`method`** : (**Required**) Request method. *(Example: 'get' or 'post')*
    * **`data`** : (**Optional**) Body of request. *(JSON format)*
    * **`headers`** : (**Optional**) Headers for request

#### Passing response to function (instead of reducers)
There might be cases when the application needs to make *Authenticated* requests to API server and the response is to be processed by a function instead of being dispatched to reducers.
The function is passed as **`responseHandler`** to the request-object.


responseHandler function is passed *response* as first argument and *successFlag* as second argument. 
* *response*: The response returned by Server.
* *successFlag*: (boolean value) true for successfully resolved response, false otherwise.

( Since the response is **not** passed to reducers, request-object no longer requires  **`sucessType`**, **`loadingType`**, **`failedType`**. )
##### Example Scenerio
```js
function logPayDetails(apiResponse, successFlag){
    if(successFlag)
        console.log("Payment Details: ", apiResponse.data)
    else
        console.log("Unable to fetch payment details.", apiResponse.response)
}

// action creator to fetch payment details
function fetchPayDetails(payID){
    let requestObject = {
        responseHandler: logPayDetails,
        request: {
            url: `www.example.com/api/payements/${payID}`,
            method: 'get'
        }
    }
    return requestObject;
}
```

# How to work with Tokens
R2SJ fetches refresh/access token from cookies. So, the application needs to be designed in a way such that tokens recieved from server are stored as cookies named **access** and **refresh**.

##### Example Scenerio

```js

import axios from 'axios';
import { cookieHelper } from 'react-redux-simple-jwt';
// cookieHelper Provides getter-setter functions for cookies

function doLogin(username, password){
    let request = axios.post('example.com/auth/login',{username, password});
    return request.then(({data}) => {
        cookieHelper.setCookie('access', data.access, 0.00347222); // save accessToken to cookie which expires in 0.00347222 days (~= 5minutes)
        cookieHelper.setCookie('refresh', data.refresh, 7); // refresh cookie expires in 7 days
    }).catch(error => window.alert("Invalid Username/Password"))
}
```

* On re-visiting the application, if refresh cookie is available, it can be assumed that the user is logged in.
* To logout, the application needs to delete both refresh and access cookie.
* **If R2SJ middleware fails to refresh access token (or find refresh cookie), it dispatches the following action:**
    ```js
    { type: 'authorization failed' }
    ```

---
**author: https://github.com/abhi204**
**repository: https://github.com/abhi204/react-redux-simple-jwt**
**issues: https://github.com/abhi204/react-redux-simple-jwt/issues**
###### License : **MIT**
