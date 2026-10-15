# 바코드 스캐너 앱 복원 가이드

## 개요
이 폴더는 바코드 스캐너 앱의 완전한 백업입니다. 휴대폰을 잃어버리더라도 이 백업을 사용하여 앱을 복원할 수 있습니다.

## 포함된 파일들
- **app-release.apk**: 설치 가능한 안드로이드 APK 파일 (71MB)
- **App.tsx**: 메인 앱 소스코드
- **package.json**: 프로젝트 의존성 정의
- **android/**: 안드로이드 네이티브 코드 및 설정
- **ios/**: iOS 네이티브 코드 및 설정
- **기타 설정 파일들**: babel.config.js, metro.config.js, tsconfig.json 등

## 복원 방법

### 1. APK 직접 설치 (가장 간단)
1. app-release.apk 파일을 안드로이드 기기로 전송
2. 기기에서 "알 수 없는 소스에서 설치 허용" 활성화
3. APK 파일을 탭하여 설치

### 2. 개발 환경에서 재빌드
1. Node.js 18+ 설치
2. Java 17 설치 (brew install --cask temurin@17)
3. Android Studio 및 Android SDK 설치
4. 이 폴더를 원하는 위치로 복사
5. 터미널에서 다음 명령어 실행:

```bash
# 의존성 설치
npm install

# Android 빌드
cd android
./gradlew assembleRelease

# APK 설치
adb install app/build/outputs/apk/release/app-release.apk
```

## 앱 기능
- **오프라인 바코드 스캔**: 인터넷 연결 없이 작동
- **자동 저장**: 스캔한 바코드를 자동으로 히스토리에 저장
- **복사 기능**: 개별 또는 전체 바코드 복사 ([값] 형식)
- **듀얼 패널**: 갤럭시 폴드 등 대형 화면에서 카메라+히스토리 동시 표시
- **플래시라이트**: 어두운 환경에서 스캔 지원
- **진동 피드백**: 스캔 성공 시 진동 알림

## 주요 설정
- **앱 이름**: BarcodeScannerApp
- **패키지명**: com.barcodescannerapp
- **권한**: 카메라, 진동
- **타겟**: Android 5.0+ (API 21+)

## 문제 해결
- **설치 실패**: "알 수 없는 소스" 허용 확인
- **카메라 권한**: 앱 설정에서 카메라 권한 허용
- **빌드 오류**: Java 17 버전 확인, Android SDK 경로 설정

## 백업 날짜
2024년 10월 8일

## 연락처
문제가 발생하면 이 백업을 사용하여 앱을 복원하거나 재빌드할 수 있습니다.
