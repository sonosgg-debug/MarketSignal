# 윈도우 작업 스케줄러(Windows Task Scheduler) 기반 선행 캐시 갱신 가이드

대시보드 지표를 로드할 때 "하루 전 데이터"가 표시되는 문제를 완벽하게 해결하고, 사용자가 언제 접근하더라도 즉각적으로 최신 데이터를 보여주기 위해 **윈도우 작업 스케줄러**를 활용해 매일 지정된 시점에 자동으로 데이터를 수집하고 캐시를 채워두는 것을 권장합니다.

---

## 1. 갱신이 필요한 핵심 스케줄

국내 금융 시장과 지표들의 마감 시점을 고려하여 하루에 2회 자동 수집을 구동하면 가장 정확하고 신선한 대시보드를 유지할 수 있습니다.

1. **오후 4시 00분 (16:00) - 평일 (월~금)**
   * **수집 대상**: 코스피 선물 지수, KOSPI PER/PBR, RSI, ADR, 거래대금 등 당일 정규장 마감 데이터.
2. **오전 6시 10분 (06:10) - 평일 (화~토)**
   * **수집 대상**: KOSPI 200 야간 선물 지수 (CME/Eurex 야간거래 마감 이후 최종 데이터).

---

## 2. 작업 스케줄러 등록 방법

윈도우 환경에서 아래 단계를 따라 수집 스크립트(`get_kospi_fundamentals.py`)를 등록합니다.

### Step 1: 실행할 배치 파일 (`run_update.bat`) 작성
윈도우 스케줄러가 파이썬 환경(가상환경 포함)을 안전하게 구동할 수 있도록 실행용 배치 파일을 생성하는 것이 좋습니다.

프로젝트 루트 또는 `src/app/api/market-data/` 내부에 `run_update.bat` 파일을 다음과 같이 작성합니다. (가상환경이 설치되어 있다면 venv의 python 경로로 대체합니다.)

```bat
@echo off
cd /d "D:\AI Investing\MarketSignal"
:: 만약 가상환경을 사용한다면 아래 주석을 풀고 가상환경 내 python.exe 경로를 지정하세요.
:: "D:\AI Investing\MarketSignal\.venv\Scripts\python.exe" "src/app/api/market-data/get_kospi_fundamentals.py"
python "src/app/api/market-data/get_kospi_fundamentals.py"
```

### Step 2: 윈도우 작업 스케줄러 설정
1. 윈도우 검색창에 **"작업 스케줄러 (Task Scheduler)"**를 입력하여 실행합니다.
2. 우측 [작업] 패널에서 **[기본 작업 만들기... (Create Basic Task...)]**를 클릭합니다.
3. **이름 및 설명 입력**:
   * 이름: `MarketSignal_KRX_Daily_Update`
   * 설명: `K Market 대시보드 데이터 캐시 선행 업데이트 스케줄러`
4. **트리거 (Trigger) 설정**:
   * 작업 시작: **[매일 (Daily)]** 선택
   * 시작 시간: `오후 4:00:00` 설정 (평일 16:00 가동)
5. **동작 (Action) 설정**:
   * 동작: **[프로그램 시작 (Start a program)]** 선택
   * 프로그램/스크립트: Step 1에서 작성한 `run_update.bat` 파일의 절대 경로 입력 (예: `D:\AI Investing\MarketSignal\src\app\api\market-data\run_update.bat`)
   * 시작 위치(옵션): `D:\AI Investing\MarketSignal`
6. **완료 및 최종 확인**:
   * [마치기]를 눌러 등록을 완료합니다.

> **[Tip] 오전 야간선물 마감용 스케줄 추가 등록**:
> 위의 과정을 반복하여 오전 6시 10분용 작업(`MarketSignal_KRX_Night_Update`)을 하나 더 등록하고 트리거 시간을 `오전 6:10`으로 지정해 두는 것을 권장합니다.

---

## 3. 작동 테스트
등록 완료 후 작업 스케줄러 목록에서 등록한 작업(`MarketSignal_KRX_Daily_Update`)을 우클릭하고 **[실행 (Run)]**을 클릭하여, `src/app/api/market-data/krx_cache.json` 캐시 파일의 갱신 시각과 데이터 내용이 정상적으로 오늘 자로 덮어써지는지 확인하세요.
