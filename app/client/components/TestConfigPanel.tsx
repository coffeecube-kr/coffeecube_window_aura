"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  mockResponses,
  buttonMockResponses,
  globalTestConfig,
  getCurrentResponseIndex,
  getTotalResponseCount,
  type MockResponse,
} from "./hooks/testConfig";

/**
 * 테스트 모드 설정을 확인하는 패널
 * 개발 중에만 사용하며, 테스트 응답 설정을 시각적으로 확인할 수 있습니다.
 */
export default function TestConfigPanel() {
  const [isExpanded, setIsExpanded] = useState(false);
  const mode = process.env.NEXT_PUBLIC_ACTION_MODE || "TEST";

  // REAL 모드에서는 표시하지 않음
  if (mode !== "TEST") {
    return null;
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            테스트 모드 설정
            <Badge variant="secondary" className="ml-2">
              {mode}
            </Badge>
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? "접기" : "펼치기"}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4">
          {/* 전역 설정 */}
          <div className="border-b pb-4">
            <h3 className="font-semibold mb-2">전역 설정</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="font-medium">디버그 모드:</span>{" "}
                <Badge
                  variant={globalTestConfig.debugMode ? "default" : "secondary"}
                >
                  {globalTestConfig.debugMode ? "ON" : "OFF"}
                </Badge>
              </div>
              <div>
                <span className="font-medium">기본 지연:</span>{" "}
                {globalTestConfig.defaultDelayMs}ms
              </div>
              <div className="col-span-2">
                <span className="font-medium">범위 초과 동작:</span>{" "}
                <Badge variant="outline">
                  {globalTestConfig.outOfBoundsBehavior === "repeat-last"
                    ? "마지막 응답 반복"
                    : "처음부터 반복"}
                </Badge>
              </div>
            </div>
          </div>

          {/* 버튼별 Mock 응답 리스트 */}
          <div>
            <h3 className="font-semibold mb-2">버튼별 Mock 응답 설정</h3>
            <div className="bg-yellow-50 dark:bg-yellow-950 p-2 rounded-md text-xs mb-2">
              <p className="text-muted-foreground">
                각 버튼의 명령이 실행될 때마다 해당 버튼의 응답 리스트에서
                순차적으로 응답을 가져옵니다.
              </p>
            </div>
            <div className="space-y-4 max-h-[500px] overflow-y-auto">
              {Object.entries(buttonMockResponses).map(
                ([buttonName, responses]) => (
                  <div key={buttonName} className="border rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="default">{buttonName}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {responses.length}개 응답
                      </span>
                    </div>
                    <div className="space-y-2">
                      {responses.map((response, index) => (
                        <ResponseItem
                          key={index}
                          response={response}
                          index={index}
                        />
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
          </div>

          {/* 기본 Mock 응답 리스트 (deprecated) */}
          <div>
            <h3 className="font-semibold mb-2">
              기본 Mock 응답 리스트 ({getTotalResponseCount()}개)
              <Badge variant="secondary" className="ml-2 text-xs">
                deprecated
              </Badge>
            </h3>
            <div className="bg-gray-50 dark:bg-gray-950 p-2 rounded-md text-xs mb-2">
              <p className="text-muted-foreground">
                버튼명이 매칭되지 않을 때 사용되는 기본 응답입니다.
              </p>
            </div>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {mockResponses.map((response, index) => (
                <ResponseItem key={index} response={response} index={index} />
              ))}
            </div>
          </div>

          {/* 안내 메시지 */}
          <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-md text-sm">
            <p className="font-medium mb-1">⚙️ 설정 수정 방법</p>
            <p className="text-muted-foreground mb-2">
              <code className="bg-white dark:bg-gray-800 px-1 py-0.5 rounded">
                app/client/components/hooks/testConfig.ts
              </code>{" "}
              파일의{" "}
              <code className="bg-white dark:bg-gray-800 px-1 py-0.5 rounded">
                buttonMockResponses
              </code>{" "}
              객체를 수정하세요.
            </p>
            <p className="text-xs text-muted-foreground">
              • 각 버튼명을 키로 하여 응답 배열 설정
              <br />
              • 버튼의 첫 번째 명령 → 해당 버튼 응답[0] 반환
              <br />
              • 버튼의 두 번째 명령 → 해당 버튼 응답[1] 반환
              <br />• ...
            </p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function ResponseItem({
  response,
  index,
}: {
  response: MockResponse;
  index: number;
}) {
  return (
    <div className="border rounded-md p-3 bg-gray-50 dark:bg-gray-900">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline">#{index + 1}</Badge>
          <code className="text-sm font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded">
            {response.receive}
          </code>
        </div>
        <Badge variant={response.shouldSucceed ? "default" : "destructive"}>
          {response.shouldSucceed ? "성공" : "실패"}
        </Badge>
      </div>
      <div className="text-sm text-muted-foreground">
        <span className="font-medium">지연:</span> {response.delayMs}ms
      </div>
    </div>
  );
}
