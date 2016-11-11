
import contracts = require("../common/contracts");
import express = require('express');
import Rx = require('rx');
import RxNode = require('rx-node');
import http = require('http');
import https = require('https');
import url = require('url');

import IAuthUrl = contracts.IAuthUrl;
import IAuthTokens = contracts.IAuthTokens;

export class YouTubeAuthenticationServer{

	static baseUrl = "https://accounts.google.com/o/oauth2/";

	static tokenRequestUrlRegularExpression = /\/api\/tokenRequestUrl\/redirect\/([^\/?&]+)/;
	static tokenExchangeRegularExpression = /\/api\/exchangeTokens\/code\/([^\/]+)\/redirect\/([^\/?&]+)/;

	handleRequest(request: express.Request): Rx.Observable<string>{
		var response: Rx.Observable<any>;

		if(YouTubeAuthenticationServer.tokenRequestUrlRegularExpression.test(request.url)){
			response = this.getTokenRequestUrl(request.url);
		}
		else if(YouTubeAuthenticationServer.tokenExchangeRegularExpression.test(request.url)){
			response = this.exchangeTokens(request.url);
		}
		else{
			const warning = `api method not found for ${request.url}`;
			console.warn(warning);
			return Rx.Observable.return(warning);
		}

		return response.map( data => JSON.stringify(data));
	}

	private getTokenRequestUrl(requestUrl: string): Rx.Observable<IAuthUrl> {

		const urlMatches = YouTubeAuthenticationServer.tokenRequestUrlRegularExpression.exec(requestUrl);

		let url = YouTubeAuthenticationServer.baseUrl + "auth";

		const redirectUri = decodeURIComponent(urlMatches[1]);
		const scope = "https://www.googleapis.com/auth/youtube.readonly";

		url += "?client_id=" + encodeURIComponent(process.env.CLIENT_ID);
		url += "&redirect_uri=" + encodeURIComponent(redirectUri);
		url += "&scope=" + encodeURIComponent(scope);
		url += "&response_type=code";

		return Rx.Observable.just({authUrl: url});
	}

	private exchangeTokens(requestUrl: string): Rx.Observable<IAuthTokens>{

		const urlMatches = YouTubeAuthenticationServer.tokenExchangeRegularExpression.exec(requestUrl);

		const code = decodeURIComponent(urlMatches[1]);
		const redirectUri = decodeURIComponent(urlMatches[2]);

		let url = YouTubeAuthenticationServer.baseUrl + "token";

		var postData= "code=" + encodeURIComponent(code);
		postData += "&redirect_uri=" + encodeURIComponent(redirectUri);
		postData += "&client_id=" + encodeURIComponent(process.env.CLIENT_ID);
		postData += "&client_secret=" + encodeURIComponent(process.env.CLIENT_SECRET);
		postData += "&grant_type=authorization_code";

		return this.makePostRequest<IAuthTokens>(url,postData);
	}

	private makePostRequest<T>(targetUrl:string, data: string): Rx.Observable<T>{

		var urlObject = url.parse(targetUrl);

		var options: http.RequestOptions = {
			hostname: urlObject.hostname,
			port: Number(urlObject.port),
			path: urlObject.path,
			protocol: "https:",
			method: "POST",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded"
			}
		};

		const request = https.request(options);

		const returnObservable = Rx.Observable.fromEvent(<any>request, "response")
			.take(1)
			.flatMap( response => RxNode.fromReadableStream(<any>response))
			.toArray()
			.map(function(allData){
				return JSON.parse(allData.join("")) as T;
			});

		request.write(data);
		request.end();

		return returnObservable;
	}
}
